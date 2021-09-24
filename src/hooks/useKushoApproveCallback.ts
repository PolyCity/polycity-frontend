import KushoCooker, { signMasterContractApproval } from '../entities/KushoCooker'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { KUSHO_ADDRESS } from '@polycity/sdk'
import { setKushoApprovalPending } from '../state/application/actions'
import { useActiveWeb3React } from './useActiveWeb3React'
import { useAntiqueBoxContract } from './useContract'
import { useAntiqueMasterContractAllowed } from '../state/antiquebox/hooks'
import { useDispatch } from 'react-redux'
import { useKushoApprovalPending } from '../state/application/hooks'
import { useTransactionAdder } from '../state/transactions/hooks'
import { AddressZero, HashZero } from '@ethersproject/constants'
import { splitSignature } from '@ethersproject/bytes'

export enum AntiqueApprovalState {
  UNKNOWN,
  NOT_APPROVED,
  PENDING,
  FAILED,
  APPROVED,
}

export interface KushoPermit {
  account: string
  masterContract: string
  v: number
  r: string
  s: string
}

export enum AntiqueApproveOutcome {
  SUCCESS,
  REJECTED,
  FAILED,
  NOT_READY,
}

export type AntiqueApproveResult = {
  outcome: AntiqueApproveOutcome
  permit?: KushoPermit
}

// returns a variable indicating the state of the approval and a function which approves if necessary or early returns
function useKushoApproveCallback(): [
  AntiqueApprovalState,
  boolean,
  KushoPermit | undefined,
  () => void,
  (pair: any, execute: (cooker: KushoCooker) => Promise<string>) => void
] {
  const { account, library, chainId } = useActiveWeb3React()
  const dispatch = useDispatch()
  const [approveKushoFallback, setApproveKushoFallback] = useState<boolean>(false)
  const [kushoPermit, setKushoPermit] = useState<KushoPermit | undefined>(undefined)

  useEffect(() => {
    setKushoPermit(undefined)
  }, [account, chainId])

  const masterContract = chainId && KUSHO_ADDRESS[chainId]

  const pendingApproval = useKushoApprovalPending()
  const currentAllowed = useAntiqueMasterContractAllowed(masterContract, account || AddressZero)
  const addTransaction = useTransactionAdder()

  // check the current approval status
  const approvalState: AntiqueApprovalState = useMemo(() => {
    if (!masterContract) return AntiqueApprovalState.UNKNOWN
    if (!currentAllowed && pendingApproval) return AntiqueApprovalState.PENDING

    return currentAllowed ? AntiqueApprovalState.APPROVED : AntiqueApprovalState.NOT_APPROVED
  }, [masterContract, currentAllowed, pendingApproval])

  const antiqueBoxContract = useAntiqueBoxContract()

  const approve = useCallback(async (): Promise<AntiqueApproveResult> => {
    if (approvalState !== AntiqueApprovalState.NOT_APPROVED) {
      console.error('approve was called unnecessarily')
      return { outcome: AntiqueApproveOutcome.NOT_READY }
    }
    if (!masterContract) {
      console.error('no token')
      return { outcome: AntiqueApproveOutcome.NOT_READY }
    }

    if (!antiqueBoxContract) {
      console.error('no antiquebox contract')
      return { outcome: AntiqueApproveOutcome.NOT_READY }
    }

    if (!account) {
      console.error('no account')
      return { outcome: AntiqueApproveOutcome.NOT_READY }
    }
    if (!library) {
      console.error('no library')
      return { outcome: AntiqueApproveOutcome.NOT_READY }
    }

    try {
      const signature = await signMasterContractApproval(
        antiqueBoxContract,
        masterContract,
        account,
        library,
        true,
        chainId
      )
      const { v, r, s } = splitSignature(signature)
      return {
        outcome: AntiqueApproveOutcome.SUCCESS,
        permit: { account, masterContract, v, r, s },
      }
    } catch (e) {
      return {
        outcome: e.code === 4001 ? AntiqueApproveOutcome.REJECTED : AntiqueApproveOutcome.FAILED,
      }
    }
  }, [approvalState, account, library, chainId, antiqueBoxContract, masterContract])

  const onApprove = async function () {
    if (!approveKushoFallback) {
      const result = await approve()
      if (result.outcome === AntiqueApproveOutcome.SUCCESS) {
        setKushoPermit(result.permit)
      } else if (result.outcome === AntiqueApproveOutcome.FAILED) {
        setApproveKushoFallback(true)
      }
    } else {
      const tx = await antiqueBoxContract?.setMasterContractApproval(
        account,
        masterContract,
        true,
        0,
        HashZero,
        HashZero
      )
      dispatch(setKushoApprovalPending('Approve Kusho'))
      await tx.wait()
      dispatch(setKushoApprovalPending(''))
    }
  }

  const onCook = async function (pair: any, execute: (cooker: KushoCooker) => Promise<string>) {
    const cooker = new KushoCooker(pair, account, library, chainId)
    let summary
    if (approvalState === AntiqueApprovalState.NOT_APPROVED && kushoPermit) {
      cooker.approve(kushoPermit)
      summary = 'Approve Kusho and ' + (await execute(cooker))
    } else {
      summary = await execute(cooker)
    }
    const result = await cooker.cook()
    if (result.success) {
      addTransaction(result.tx, { summary })
      setKushoPermit(undefined)
      await result.tx.wait()
    }
  }

  return [approvalState, approveKushoFallback, kushoPermit, onApprove, onCook]
}

export default useKushoApproveCallback
