import { useEffect, useMemo } from 'react'
import useSWR, { SWRConfiguration } from 'swr'

import { ChainId } from '@polycity/sdk'
import { getKushoPairs, getUserKushoPairs, getAntiqueUserTokens } from '../fetchers/antiquebox'
import { useActiveWeb3React } from '../../../hooks'
import { useBlock } from './blocks'
import { Feature, featureEnabled } from '../../../functions/feature'

interface useKushoPairsProps {
  timestamp?: number
  block?: number
  chainId?: number
  shouldFetch?: boolean
  user?: string
  subset?: string[]
}

export function useKushoPairs(
  {
    timestamp,
    block,
    chainId = useActiveWeb3React().chainId,
    shouldFetch = true,
    user,
    subset,
  }: useKushoPairsProps = {},
  swrConfig: SWRConfiguration = undefined
) {
  const blockFetched = useBlock({ timestamp, shouldFetch: shouldFetch && !!timestamp })
  block = block ?? (timestamp ? blockFetched : undefined)

  shouldFetch = shouldFetch ? featureEnabled(Feature['KUSHO'], chainId) : false

  const variables = {
    block: block ? { number: block } : undefined,
    where: {
      user: user?.toLowerCase(),
      id_in: subset?.map((id) => id.toLowerCase()),
    },
  }

  const { data } = useSWR(
    shouldFetch ? () => ['kushoPairs', chainId, JSON.stringify(variables)] : null,
    (_, chainId) => getKushoPairs(chainId, variables),
    swrConfig
  )

  return data
}

export function useUserKushoPairs(variables = undefined, chainId = undefined, swrConfig: SWRConfiguration = undefined) {
  const { chainId: chainIdSelected, account } = useActiveWeb3React()
  chainId = chainId ?? chainIdSelected

  const shouldFetch = chainId && account

  variables =
    Object.keys(variables ?? {}).includes('user') && account
      ? variables
      : account
      ? { ...variables, user: account.toLowerCase() }
      : ''

  const { data } = useSWR(
    shouldFetch ? ['userKushoPairs', chainId, JSON.stringify(variables)] : null,
    () => getUserKushoPairs(chainId, variables),
    swrConfig
  )

  return data
}

export function useAntiqueUserTokens(
  variables = undefined,
  chainId = undefined,
  swrConfig: SWRConfiguration = undefined
) {
  const { chainId: chainIdSelected, account } = useActiveWeb3React()
  chainId = chainId ?? chainIdSelected

  const shouldFetch = chainId && account

  variables = Object.keys(variables ?? {}).includes('user')
    ? variables
    : account
    ? { ...variables, user: account.toLowerCase() }
    : ''

  const { data } = useSWR(
    shouldFetch ? ['antiqueUserTokens', chainId, JSON.stringify(variables)] : null,
    () => getAntiqueUserTokens(chainId, variables),
    swrConfig
  )

  return data
}
