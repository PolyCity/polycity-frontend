import { CRXPICHI, PICHI } from '../../../config/tokens'
import { ChainId, PICHI_ADDRESS, Token } from '@polycity/sdk'
import { StrategyGeneralInfo, StrategyHook, StrategyTokenDefinitions } from '../types'
import { e10, tryParseAmount } from '../../../functions'
import { useActiveWeb3React, useZenkoContract } from '../../../hooks'
import { useCallback, useEffect, useMemo } from 'react'

import { BigNumber } from '@ethersproject/bignumber'
import { I18n } from '@lingui/core'
import { t } from '@lingui/macro'
import useBaseStrategy from './useBaseStrategy'
import { useAntiqueBalance } from '../../antiquebox/hooks'
import useAntiqueBoxTrait from '../traits/useAntiqueBoxTrait'
import { useLingui } from '@lingui/react'
import usePichiPerXPichi from '../../../hooks/useXPichiPerPichi'
import { useTokenBalances } from '../../wallet/hooks'

export const GENERAL = (i18n: I18n): StrategyGeneralInfo => ({
  name: i18n._(t`Cream → Antique`),
  steps: [i18n._(t`PICHI`), i18n._(t`crXPICHI`), i18n._(t`AntiqueBox`)],
  zapMethod: 'stakePichiToCreamToAntique',
  unzapMethod: 'unstakePichiFromCreamFromAntique',
  description: i18n._(t`Stake PICHI for xPICHI into Cream and deposit crXPICHI into AntiqueBox in one click.`),
  inputSymbol: i18n._(t`PICHI`),
  outputSymbol: i18n._(t`crXPICHI in AntiqueBox`),
})

export const tokenDefinitions: StrategyTokenDefinitions = {
  inputToken: {
    chainId: ChainId.MAINNET,
    address: PICHI_ADDRESS[ChainId.MAINNET],
    decimals: 18,
    symbol: 'PICHI',
  },
  outputToken: {
    chainId: ChainId.MAINNET,
    address: '0x228619cca194fbe3ebeb2f835ec1ea5080dafbb2',
    decimals: 8,
    symbol: 'crXPICHI',
  },
}

const useStakePichiToCreamToAntiqueStrategy = (): StrategyHook => {
  const { i18n } = useLingui()
  const { account } = useActiveWeb3React()
  const zenkoContract = useZenkoContract()
  const balances = useTokenBalances(account, [PICHI[ChainId.MAINNET]])
  const sushiPerXPichi = usePichiPerXPichi(true)
  const crxPichiAntiqueBalance = useAntiqueBalance(CRXPICHI.address)

  // Strategy ends in AntiqueBox so use BaseAntiqueBox strategy
  const general = useMemo(() => GENERAL(i18n), [i18n])
  const baseStrategy = useBaseStrategy({
    id: 'stakePichiToCreamToAntiqueStrategy',
    general,
    tokenDefinitions,
  })

  // Add in AntiqueBox trait as output is in AntiqueBox
  const { setBalances, calculateOutputFromInput: _, ...strategy } = useAntiqueBoxTrait(baseStrategy)

  useEffect(() => {
    if (!balances) return

    setBalances({
      inputTokenBalance: balances[PICHI[ChainId.MAINNET].address],
      outputTokenBalance: tryParseAmount(crxPichiAntiqueBalance?.value?.toFixed(8) || '0', CRXPICHI),
    })
  }, [balances, setBalances, crxPichiAntiqueBalance?.value])

  const calculateOutputFromInput = useCallback(
    async (zapIn: boolean, inputValue: string, inputToken: Token, outputToken: Token) => {
      if (!sushiPerXPichi || !inputValue || !zenkoContract) return null

      if (zapIn) {
        const value = inputValue.toBigNumber(18).mulDiv(e10(18), sushiPerXPichi.toString().toBigNumber(18)).toString()
        const cValue = await zenkoContract.toCtoken(CRXPICHI.address, value)
        return cValue.toFixed(outputToken.decimals)
      } else {
        const cValue = await zenkoContract.fromCtoken(CRXPICHI.address, inputValue.toBigNumber(inputToken.decimals))
        const value = BigNumber.from(cValue).mulDiv(sushiPerXPichi.toString().toBigNumber(18), e10(18))
        return value.toFixed(outputToken.decimals)
      }
    },
    [sushiPerXPichi, zenkoContract]
  )

  return useMemo(
    () => ({
      ...strategy,
      setBalances,
      calculateOutputFromInput,
    }),
    [strategy, calculateOutputFromInput, setBalances]
  )
}

export default useStakePichiToCreamToAntiqueStrategy
