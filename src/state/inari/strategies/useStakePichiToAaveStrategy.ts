import { AXPICHI, PICHI } from '../../../config/tokens'
import { ChainId, PICHI_ADDRESS } from '@polycity/sdk'
import { StrategyGeneralInfo, StrategyHook, StrategyTokenDefinitions } from '../types'
import { useEffect, useMemo } from 'react'

import { I18n } from '@lingui/core'
import { t } from '@lingui/macro'
import { useActiveWeb3React } from '../../../hooks'
import useBaseStrategy from './useBaseStrategy'
import { useLingui } from '@lingui/react'
import { useTokenBalances } from '../../wallet/hooks'

export const GENERAL = (i18n: I18n): StrategyGeneralInfo => ({
  name: i18n._(t`PICHI → Aave`),
  steps: [i18n._(t`PICHI`), i18n._(t`xPICHI`), i18n._(t`Aave`)],
  zapMethod: 'stakePichiToAave',
  unzapMethod: 'unstakePichiFromAave',
  description: i18n._(
    t`Stake PICHI for xPICHI and deposit into Aave in one click. xPICHI in Aave (aXPICHI) can be lent or used as collateral for borrowing.`
  ),
  inputSymbol: i18n._(t`PICHI`),
  outputSymbol: i18n._(t`xPICHI in Aave`),
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
    address: '0xf256cc7847e919fac9b808cc216cac87ccf2f47a',
    decimals: 18,
    symbol: 'aXPICHI',
  },
}

const useStakePichiToAaveStrategy = (): StrategyHook => {
  const { i18n } = useLingui()
  const { account } = useActiveWeb3React()
  const balances = useTokenBalances(account, [PICHI[ChainId.MAINNET], AXPICHI])
  const general = useMemo(() => GENERAL(i18n), [i18n])
  const { setBalances, ...strategy } = useBaseStrategy({
    id: 'stakePichiToAaveStrategy',
    general,
    tokenDefinitions,
  })

  useEffect(() => {
    if (!balances) return

    setBalances({
      inputTokenBalance: balances[PICHI[ChainId.MAINNET].address],
      outputTokenBalance: balances[AXPICHI.address],
    })
  }, [balances, setBalances])

  return useMemo(
    () => ({
      ...strategy,
      setBalances,
    }),
    [strategy, setBalances]
  )
}

export default useStakePichiToAaveStrategy
