import { ChainId, PICHI_ADDRESS } from '@polycity/sdk'
import { PICHI, XPICHI } from '../../../config/tokens'
import { StrategyGeneralInfo, StrategyHook, StrategyTokenDefinitions } from '../types'
import { useEffect, useMemo } from 'react'

import { I18n } from '@lingui/core'
import { t } from '@lingui/macro'
import { tryParseAmount } from '../../../functions'
import { useActiveWeb3React } from '../../../hooks'
import useBaseStrategy from './useBaseStrategy'
import { useAntiqueBalance } from '../../antiquebox/hooks'
import useAntiqueBoxTrait from '../traits/useAntiqueBoxTrait'
import { useLingui } from '@lingui/react'
import { useTokenBalances } from '../../wallet/hooks'

export const GENERAL = (i18n: I18n): StrategyGeneralInfo => ({
  name: i18n._(t`PICHI → Antique`),
  steps: [i18n._(t`PICHI`), i18n._(t`xPICHI`), i18n._(t`AntiqueBox`)],
  zapMethod: 'stakePichiToAntique',
  unzapMethod: 'unstakePichiFromAntique',
  description:
    i18n._(t`Stake PICHI for xPICHI and deposit into AntiqueBox in one click. xPICHI in AntiqueBox is automatically
                invested into a passive yield strategy, and can be lent or used as collateral for borrowing in Kusho.`),
  inputSymbol: i18n._(t`PICHI`),
  outputSymbol: i18n._(t`xPICHI in AntiqueBox`),
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
    address: '0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272',
    decimals: 18,
    symbol: 'XPICHI',
  },
}

const useStakePichiToAntiqueStrategy = (): StrategyHook => {
  const { i18n } = useLingui()
  const { account } = useActiveWeb3React()
  const balances = useTokenBalances(account, [PICHI[ChainId.MAINNET], XPICHI])
  const xPichiAntiqueBalance = useAntiqueBalance(XPICHI.address)

  // Strategy ends in AntiqueBox so use BaseAntiqueBox strategy
  const general = useMemo(() => GENERAL(i18n), [i18n])
  const baseStrategy = useBaseStrategy({
    id: 'stakePichiToAntiqueStrategy',
    general,
    tokenDefinitions,
  })

  // Add in AntiqueBox trait as output is in AntiqueBox
  const { setBalances, ...strategy } = useAntiqueBoxTrait(baseStrategy)

  useEffect(() => {
    if (!balances) return

    setBalances({
      inputTokenBalance: balances[PICHI[ChainId.MAINNET].address],
      outputTokenBalance: tryParseAmount(xPichiAntiqueBalance?.value?.toFixed(18) || '0', XPICHI),
    })
  }, [balances, setBalances, xPichiAntiqueBalance?.value])

  return useMemo(
    () => ({
      setBalances,
      ...strategy,
    }),
    [strategy, setBalances]
  )
}

export default useStakePichiToAntiqueStrategy
