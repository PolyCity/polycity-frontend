import { AddressZero, HashZero } from '@ethersproject/constants'
import { STOP_LIMIT_ORDER_ADDRESS, Token, getSignatureWithProviderAntiquebox } from '@polycity/sdk'
import { ZERO, calculateGasMargin } from '../functions'
import { setFromAntiqueBalance, setLimitOrderApprovalPending } from '../state/limit-order/actions'
import { useAntiqueBoxContract, useLimitOrderHelperContract } from './useContract'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDerivedLimitOrderInfo, useLimitOrderApprovalPending, useLimitOrderState } from '../state/limit-order/hooks'

import { Field } from '../state/swap/actions'
import { getAddress } from '@ethersproject/address'
import { useActiveWeb3React } from './useActiveWeb3React'
import { useAntiqueMasterContractAllowed } from '../state/antiquebox/hooks'
import { useDispatch } from 'react-redux'
import { useTransactionAdder } from '../state/transactions/hooks'

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

const useLimitOrderApproveCallback = () => {
  const { account, library, chainId } = useActiveWeb3React()
  const dispatch = useDispatch()

  const { fromAntiqueBalance } = useLimitOrderState()
  const { parsedAmounts } = useDerivedLimitOrderInfo()
  const [fallback, setFallback] = useState(false)
  const [limitOrderPermit, setLimitOrderPermit] = useState(undefined)

  useEffect(() => {
    setLimitOrderPermit(undefined)
  }, [account, chainId])

  const masterContract = chainId && STOP_LIMIT_ORDER_ADDRESS[chainId]

  const pendingApproval = useLimitOrderApprovalPending()
  const currentAllowed = useAntiqueMasterContractAllowed(masterContract, account || AddressZero)
  const addTransaction = useTransactionAdder()

  // check the current approval status
  const approvalState: AntiqueApprovalState = useMemo(() => {
    if (!masterContract) return AntiqueApprovalState.UNKNOWN
    if (!currentAllowed && pendingApproval) return AntiqueApprovalState.PENDING

    return currentAllowed ? AntiqueApprovalState.APPROVED : AntiqueApprovalState.NOT_APPROVED
  }, [masterContract, currentAllowed, pendingApproval])

  const antiqueBoxContract = useAntiqueBoxContract()
  const limitOrderHelperContract = useLimitOrderHelperContract()

  const approve = useCallback(async () => {
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
      const nonce = await antiqueBoxContract?.nonces(account)
      const { v, r, s } = await getSignatureWithProviderAntiquebox(
        {
          warning: 'Give FULL access to funds in (and approved to) AntiqueBox?',
          user: account,
          masterContract,
          approved: true,
          nonce: nonce.toString(),
        },
        chainId,
        library
      )

      return {
        outcome: AntiqueApproveOutcome.SUCCESS,
        signature: { v, r, s },
        data: antiqueBoxContract?.interface?.encodeFunctionData('setMasterContractApproval', [
          account,
          masterContract,
          true,
          v,
          r,
          s,
        ]),
      }
    } catch (e) {
      console.log(e)
      return {
        outcome: e.code === 4001 ? AntiqueApproveOutcome.REJECTED : AntiqueApproveOutcome.FAILED,
      }
    }
  }, [approvalState, account, library, chainId, antiqueBoxContract, masterContract])

  const onApprove = async function () {
    if (fallback) {
      const tx = await antiqueBoxContract?.setMasterContractApproval(
        account,
        masterContract,
        true,
        0,
        HashZero,
        HashZero
      )
      dispatch(setLimitOrderApprovalPending('Approve Limit Order'))
      await tx.wait()
      dispatch(setLimitOrderApprovalPending(''))
    } else {
      const { outcome, signature, data } = await approve()

      if (outcome === AntiqueApproveOutcome.SUCCESS) setLimitOrderPermit({ signature, data })
      else setFallback(true)
    }
  }

  const execute = async function (token: Token) {
    const summary = []
    const batch = []
    const amount = parsedAmounts[Field.INPUT].quotient.toString()

    // Since the setMasterContractApproval is not payable, we can't batch native deposit and approve
    // For this case, we setup a helper contract
    if (
      token.isNative &&
      approvalState === AntiqueApprovalState.NOT_APPROVED &&
      limitOrderPermit &&
      !fromAntiqueBalance
    ) {
      summary.push(`Approve Limit Order and Deposit ${token.symbol} into AntiqueBox`)
      const {
        signature: { v, r, s },
      } = limitOrderPermit

      const estimatedGas = await limitOrderHelperContract?.estimateGas.depositAndApprove(
        account,
        masterContract,
        true,
        v,
        r,
        s,
        {
          value: amount,
        }
      )

      const tx = await limitOrderHelperContract?.depositAndApprove(account, masterContract, true, v, r, s, {
        value: amount,
        gasLimit: calculateGasMargin(estimatedGas),
      })

      addTransaction(tx, { summary: summary.join('') })
      setLimitOrderPermit(undefined)
      return tx
    }

    // If antique is not yet approved but we do have the permit, add the permit to the batch
    if (approvalState === AntiqueApprovalState.NOT_APPROVED && limitOrderPermit) {
      batch.push(limitOrderPermit.data)
      summary.push('Approve Limit Order')
    }

    if (!fromAntiqueBalance) {
      summary.push(`Deposit ${token.symbol} into AntiqueBox`)
      if (token.isNative) {
        batch.push(
          antiqueBoxContract?.interface?.encodeFunctionData('deposit', [AddressZero, account, account, amount, 0])
        )
      } else {
        batch.push(
          antiqueBoxContract?.interface?.encodeFunctionData('deposit', [
            getAddress(token.wrapped.address),
            account,
            account,
            amount,
            0,
          ])
        )
      }
    }

    const tx = await antiqueBoxContract?.batch(batch, true, {
      value: token.isNative ? amount : ZERO,
    })
    addTransaction(tx, { summary: summary.join(', ') })
    setLimitOrderPermit(undefined)
    return tx
  }

  return [approvalState, fallback, limitOrderPermit, onApprove, execute]
}

export default useLimitOrderApproveCallback
