import { ApprovalState, useActiveWeb3React, useInariContract } from '../../../hooks'
import { CurrencyAmount, Token } from '@polycity/sdk'
import useAntiqueMasterApproveCallback, {
  AntiqueMasterApproveCallback,
} from '../../../hooks/useAntiqueMasterApproveCallback'
import useTrait, { BaseTrait } from './useTrait'

import { BaseStrategyHook } from '../strategies/useBaseStrategy'
import { useCallback } from 'react'
import { useDerivedInariState } from '../hooks'
import { useTransactionAdder } from '../../transactions/hooks'

const TRAIT_CONFIG = {
  overrides: ['execute', 'approveCallback', 'antiqueApproveCallback'],
}

export interface BaseStrategyWithAntiqueBoxTraitHook
  extends Omit<BaseStrategyHook, 'approveCallback' | 'antiqueApproveCallback'>,
    BaseTrait {
  approveCallback: [ApprovalState, () => Promise<void>] | null
  antiqueApproveCallback?: AntiqueMasterApproveCallback
  overrides: string[]
}

// Use this trait when strategies have AntiqueBox as their output.
// Strategies that end up in AntiqueBox don't need to to approve inari to spend tokens when unzapping
// hence the approveCallback is null when unzapping
const useAntiqueBoxTrait = (props: BaseStrategyHook): BaseStrategyWithAntiqueBoxTraitHook => {
  const trait = useTrait(props, TRAIT_CONFIG)
  const { account } = useActiveWeb3React()
  const { zapIn } = useDerivedInariState()
  const inariContract = useInariContract()
  const addTransaction = useTransactionAdder()
  const antiqueApproveCallback = useAntiqueMasterApproveCallback(inariContract.address, {
    otherAntiqueBoxContract: inariContract,
    contractName: 'Inari',
    functionFragment: 'setAntiqueApproval',
  })

  // Batch execute with permit if one is provided or else execute normally
  const batchExecute = useCallback(
    async (val: CurrencyAmount<Token>) => {
      if (!inariContract) return

      const method = zapIn ? props.general.zapMethod : props.general.unzapMethod

      try {
        // If we have a permit, batch tx with permit
        if (antiqueApproveCallback.permit) {
          const batch = [
            antiqueApproveCallback.permit.data,
            inariContract?.interface?.encodeFunctionData(method, [
              account,
              val.toExact().toBigNumber(val.currency.decimals),
            ]),
          ]

          const tx = await inariContract.batch(batch, true)
          addTransaction(tx, {
            summary: `Approve Inari Master Contract and ${zapIn ? 'Deposit' : 'Withdraw'} ${
              props.general.outputSymbol
            }`,
          })

          return tx
        }

        // Else proceed normally
        else return props.execute(val)
      } catch (error) {
        console.error(error)
      }
    },
    [account, addTransaction, antiqueApproveCallback.permit, inariContract, props, zapIn]
  )

  // When we unzap from antiqueBox we only need an EIP-712 permit,
  // so we don't have to check if we have approved inari to spend the token
  return {
    ...trait,
    execute: batchExecute,
    approveCallback: !zapIn ? null : props.approveCallback,
    antiqueApproveCallback,
  }
}

export default useAntiqueBoxTrait
