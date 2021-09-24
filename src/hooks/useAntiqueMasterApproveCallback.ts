import { useAntiqueMasterContractAllowed } from '../state/antiquebox/hooks'
import { useActiveWeb3React, useAntiqueBoxContract } from './index'
import { useAllTransactions, useTransactionAdder } from '../state/transactions/hooks'
import { useCallback, useMemo, useState } from 'react'
import { signMasterContractApproval } from '../entities/KushoCooker'
import { Contract } from '@ethersproject/contracts'
import { AddressZero, HashZero } from '@ethersproject/constants'
import { splitSignature } from '@ethersproject/bytes'

export enum AntiqueApprovalState {
  UNKNOWN,
  NOT_APPROVED,
  PENDING,
  FAILED,
  APPROVED,
}

export enum AntiqueApproveOutcome {
  SUCCESS,
  REJECTED,
  FAILED,
  NOT_READY,
}

const useAntiqueHasPendingApproval = (masterContract: string, account: string, contractName?: string) => {
  const allTransactions = useAllTransactions()
  return useMemo(
    () =>
      typeof masterContract === 'string' &&
      typeof account === 'string' &&
      Object.keys(allTransactions).some((hash) => {
        const tx = allTransactions[hash]
        if (!tx) return false
        if (tx.receipt) {
          return false
        } else {
          const summary = tx.summary
          if (!summary) return false
          return summary === `Approving ${contractName} Master Contract`
        }
      }),
    [allTransactions, account, masterContract]
  )
}

export interface AntiquePermit {
  outcome: AntiqueApproveOutcome
  signature?: { v: number; r: string; s: string }
  data?: string
}

export interface AntiqueMasterApproveCallback {
  approvalState: AntiqueApprovalState
  approve: () => Promise<void>
  getPermit: () => Promise<AntiquePermit>
  permit: AntiquePermit
}

export interface AntiqueMasterApproveCallbackOptions {
  otherAntiqueBoxContract?: Contract | null
  contractName?: string
  functionFragment?: string
}

const useAntiqueMasterApproveCallback = (
  masterContract: string,
  { otherAntiqueBoxContract, contractName, functionFragment }: AntiqueMasterApproveCallbackOptions
): AntiqueMasterApproveCallback => {
  const { account, chainId, library } = useActiveWeb3React()
  const antiqueBoxContract = useAntiqueBoxContract()
  const addTransaction = useTransactionAdder()
  const currentAllowed = useAntiqueMasterContractAllowed(masterContract, account || AddressZero)
  const pendingApproval = useAntiqueHasPendingApproval(masterContract, account, contractName)
  const [permit, setPermit] = useState<AntiquePermit>(null)

  const approvalState: AntiqueApprovalState = useMemo(() => {
    if (permit) return AntiqueApprovalState.APPROVED
    if (pendingApproval) return AntiqueApprovalState.PENDING

    // We might not have enough data to know whether or not we need to approve
    if (currentAllowed === undefined) return AntiqueApprovalState.UNKNOWN
    if (!masterContract || !account) return AntiqueApprovalState.UNKNOWN
    if (!currentAllowed) return AntiqueApprovalState.NOT_APPROVED

    return AntiqueApprovalState.APPROVED
  }, [account, currentAllowed, masterContract, pendingApproval, permit])

  const getPermit = useCallback(async () => {
    if (approvalState !== AntiqueApprovalState.NOT_APPROVED) {
      console.error('approve was called unnecessarily')
      return
    }

    if (!masterContract) {
      console.error('masterContract is null')
      return
    }

    if (!account) {
      console.error('no account')
      return
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
      const permit = {
        outcome: AntiqueApproveOutcome.SUCCESS,
        signature: { v, r, s },
        data: (otherAntiqueBoxContract || antiqueBoxContract)?.interface?.encodeFunctionData(
          functionFragment || 'setMasterContractApproval',
          [account, masterContract, true, v, r, s]
        ),
      }

      setPermit(permit)
      return permit
    } catch (e) {
      return {
        outcome: e.code === 4001 ? AntiqueApproveOutcome.REJECTED : AntiqueApproveOutcome.FAILED,
      }
    }
  }, [
    account,
    approvalState,
    antiqueBoxContract,
    chainId,
    functionFragment,
    library,
    masterContract,
    otherAntiqueBoxContract,
  ])

  const approve = useCallback(async () => {
    try {
      const tx = await antiqueBoxContract?.setMasterContractApproval(
        account,
        masterContract,
        true,
        0,
        HashZero,
        HashZero
      )

      return addTransaction(tx, {
        summary: `Approving ${contractName} Master Contract`,
      })
    } catch (e) {}
  }, [account, addTransaction, antiqueBoxContract, contractName, masterContract])

  return {
    approvalState,
    approve,
    getPermit,
    permit,
  }
}

export default useAntiqueMasterApproveCallback
