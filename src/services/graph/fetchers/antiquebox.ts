import { antiqueUserTokensQuery, kushoPairsQuery, kushoUserPairsQuery } from '../queries/antiquebox'
import { getFraction, toAmount } from '../../../functions'

import { ChainId } from '@polycity/sdk'
import { GRAPH_HOST } from '../constants'
import { getTokenSubset } from './exchange'
import { pager } from '.'

export const ANTIQUEBOX = {
  [ChainId.MAINNET]: 'sushiswap/antiquebox',
  [ChainId.XDAI]: 'sushiswap/xdai-antiquebox',
  [ChainId.MATIC]: 'sushiswap/matic-antiquebox',
  [ChainId.FANTOM]: 'sushiswap/fantom-antiquebox',
  [ChainId.BSC]: 'sushiswap/bsc-antiquebox',
  [ChainId.ARBITRUM]: 'sushiswap/arbitrum-antiquebox',
}
export const fetcher = async (chainId = ChainId.MAINNET, query, variables = undefined) =>
  pager(`${GRAPH_HOST[chainId]}/subgraphs/name/${ANTIQUEBOX[chainId]}`, query, variables)

export const getKushoPairs = async (chainId = ChainId.MAINNET, variables = undefined) => {
  const { kushoPairs } = await fetcher(chainId, kushoPairsQuery, variables)

  const tokens = await getTokenSubset(chainId, {
    tokenAddresses: Array.from(
      kushoPairs.reduce(
        (previousValue, currentValue) => previousValue.add(currentValue.asset.id, currentValue.collateral.id),
        new Set() // use set to avoid duplicates
      )
    ),
  })

  return kushoPairs.map((pair) => ({
    ...pair,
    token0: {
      ...pair.asset,
      ...tokens.find((token) => token.id === pair.asset.id),
    },
    token1: {
      ...pair.collateral,
      ...tokens.find((token) => token.id === pair.collateral.id),
    },
    assetAmount: Math.floor(pair.totalAssetBase / getFraction({ ...pair, token0: pair.asset })).toString(),
    borrowedAmount: toAmount(
      {
        antiqueAmount: pair.totalBorrowElastic.toBigNumber(0),
        antiqueShare: pair.totalBorrowBase.toBigNumber(0),
      },
      pair.totalBorrowElastic.toBigNumber(0)
    ).toString(),
    collateralAmount: toAmount(
      {
        antiqueAmount: pair.collateral.totalSupplyElastic.toBigNumber(0),
        antiqueShare: pair.collateral.totalSupplyBase.toBigNumber(0),
      },
      pair.totalCollateralShare.toBigNumber(0)
    ).toString(),
  }))
}

export const getUserKushoPairs = async (chainId = ChainId.MAINNET, variables) => {
  const { userKushoPairs } = await fetcher(chainId, kushoUserPairsQuery, variables)

  return userKushoPairs.map((userPair) => ({
    ...userPair,
    assetAmount: Math.floor(
      userPair.assetFraction / getFraction({ ...userPair.pair, token0: userPair.pair.asset })
    ).toString(),
    borrowedAmount: toAmount(
      {
        antiqueAmount: userPair.pair.totalBorrowElastic.toBigNumber(0),
        antiqueShare: userPair.pair.totalBorrowBase.toBigNumber(0),
      },
      userPair.borrowPart.toBigNumber(0)
    ).toString(),
    collateralAmount: toAmount(
      {
        antiqueAmount: userPair.pair.collateral.totalSupplyElastic.toBigNumber(0),
        antiqueShare: userPair.pair.collateral.totalSupplyBase.toBigNumber(0),
      },
      userPair.collateralShare.toBigNumber(0)
    ).toString(),
  }))
}

export const getAntiqueUserTokens = async (chainId = ChainId.MAINNET, variables) => {
  const { userTokens } = await fetcher(chainId, antiqueUserTokensQuery, variables)

  return userTokens
    .map((token) => ({
      ...(token.token as any),
      shares: token.share as string,
    }))
    .map((token) => ({
      ...token,
      amount: toAmount(
        {
          antiqueAmount: token.totalSupplyElastic.toBigNumber(0),
          antiqueShare: token.totalSupplyBase.toBigNumber(0),
        },
        token.shares.toBigNumber(0)
      ).toString(),
    }))
}
