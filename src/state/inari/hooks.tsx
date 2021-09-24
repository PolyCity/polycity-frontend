import { useAppSelector } from '../hooks'
import { Token } from '@polycity/sdk'
import { tryParseAmount } from '../../functions'
import useStakePichiToAntiqueStrategy from './strategies/useStakePichiToAntiqueStrategy'
import { DerivedInariState, InariState } from './types'
import useStakePichiToCreamStrategy from './strategies/useStakePichiToCreamStrategy'
import useStakePichiToCreamToAntiqueStrategy from './strategies/useStakePichiToCreamToAntiqueStrategy'
import useStakePichiToAaveStrategy from './strategies/useStakePichiToAaveStrategy'
import { useMemo } from 'react'

export function useInariState(): InariState {
  return useAppSelector((state) => state.inari)
}

// Redux doesn't allow for non-serializable classes so use a derived state hook for complex values
// Derived state may not use any of the strategy hooks to avoid an infinite loop
export function useDerivedInariState(): DerivedInariState {
  const { inputValue, outputValue, tokens, general, ...rest } = useInariState()

  // BalancePanel input token
  const inputToken = useMemo(
    () =>
      new Token(
        tokens.inputToken.chainId,
        tokens.inputToken.address,
        tokens.inputToken.decimals,
        tokens.inputToken.symbol
      ),
    [tokens.inputToken.address, tokens.inputToken.chainId, tokens.inputToken.decimals, tokens.inputToken.symbol]
  )

  // BalancePanel output token
  const outputToken = useMemo(
    () =>
      new Token(
        tokens.outputToken.chainId,
        tokens.outputToken.address,
        tokens.outputToken.decimals,
        tokens.outputToken.symbol
      ),
    [tokens.outputToken.address, tokens.outputToken.chainId, tokens.outputToken.decimals, tokens.outputToken.symbol]
  )

  return useMemo(
    () => ({
      ...rest,
      inputValue: tryParseAmount(inputValue, inputToken),
      outputValue: tryParseAmount(outputValue, outputToken),
      general,
      tokens: {
        inputToken,
        outputToken,
      },
    }),
    [general, inputToken, inputValue, outputToken, outputValue, rest]
  )
}

export function useSelectedInariStrategy() {
  const { id: selectedStrategy } = useInariState()
  const strategies = useInariStrategies()
  return useMemo(() => strategies[selectedStrategy], [selectedStrategy, strategies])
}

// Use this hook to register all strategies
export function useInariStrategies() {
  const stakePichiToAntiqueStrategy = useStakePichiToAntiqueStrategy()
  const stakePichiToCreamStrategy = useStakePichiToCreamStrategy()
  const stakePichiToAaveStrategy = useStakePichiToAaveStrategy()

  return useMemo(
    () => ({
      [stakePichiToAntiqueStrategy.id]: stakePichiToAntiqueStrategy,
      [stakePichiToCreamStrategy.id]: stakePichiToCreamStrategy,
      [stakePichiToAaveStrategy.id]: stakePichiToAaveStrategy,
    }),
    [stakePichiToAaveStrategy, stakePichiToAntiqueStrategy, stakePichiToCreamStrategy]
  )
}
