import { Chef, PairType } from '../features/onsen/enum'
import {
  useAverageBlockTime,
  useFarms,
  useKushoPairs,
  useMasterChefV1PichiPerBlock,
  useMasterChefV1TotalAllocPoint,
  useMaticPrice,
  useNativePrice,
  useStakePrice,
  usePichiPairs,
  usePichiPrice,
} from '../services/graph'

import { ChainId } from '@polycity/sdk'
import { getAddress } from '@ethersproject/address'
import useActiveWeb3React from './useActiveWeb3React'
import { useMemo } from 'react'
import { usePositions } from '../features/onsen/hooks'

export default function useFarmRewards() {
  const { chainId } = useActiveWeb3React()

  const positions = usePositions()

  const farms = useFarms()
  const farmAddresses = useMemo(() => farms.map((farm) => farm.pair), [farms])
  const swapPairs = usePichiPairs({ subset: farmAddresses, shouldFetch: !!farmAddresses })
  const kushoPairs = useKushoPairs({ subset: farmAddresses, shouldFetch: !!farmAddresses })

  const averageBlockTime = useAverageBlockTime()
  const masterChefV1TotalAllocPoint = useMasterChefV1TotalAllocPoint()
  const masterChefV1PichiPerBlock = useMasterChefV1PichiPerBlock()

  const [sushiPrice, nativePrice, maticPrice, stakePrice] = [
    usePichiPrice(),
    useNativePrice(),
    useMaticPrice(),
    useStakePrice(),
  ]

  const blocksPerDay = 86400 / Number(averageBlockTime)

  const map = (pool) => {
    // TODO: Account for fees generated in case of swap pairs, and use standard compounding
    // algorithm with the same intervals acrosss chains to account for consistency.
    // For lending pairs, what should the equivilent for fees generated? Interest gained?
    // How can we include this?

    // TODO: Deal with inconsistencies between properties on subgraph
    pool.owner = pool?.owner || pool?.masterChef || pool?.miniChef
    pool.balance = pool?.balance || pool?.slpBalance

    const swapPair = swapPairs?.find((pair) => pair.id === pool.pair)
    const kushoPair = kushoPairs?.find((pair) => pair.id === pool.pair)

    const type = swapPair ? PairType.SWAP : PairType.KUSHO

    const pair = swapPair || kushoPair

    const blocksPerHour = 3600 / averageBlockTime

    function getRewards() {
      // TODO: Some subgraphs give sushiPerBlock & sushiPerSecond, and mcv2 gives nothing
      const sushiPerBlock =
        pool?.owner?.sushiPerBlock / 1e18 ||
        (pool?.owner?.sushiPerSecond / 1e18) * averageBlockTime ||
        masterChefV1PichiPerBlock

      const rewardPerBlock = (pool.allocPoint / pool.owner.totalAllocPoint) * sushiPerBlock

      const defaultReward = {
        token: 'PICHI',
        icon: 'https://raw.githubusercontent.com/sushiswap/icons/master/token/sushi.jpg',
        rewardPerBlock,
        rewardPerDay: rewardPerBlock * blocksPerDay,
        rewardPrice: sushiPrice,
      }

      let rewards = [defaultReward]

      if (pool.chef === Chef.MASTERCHEF_V2) {
        // override for mcv2...
        pool.owner.totalAllocPoint = masterChefV1TotalAllocPoint

        const icon = ['0', '3', '4', '8'].includes(pool.id)
          ? `https://raw.githubusercontent.com/sushiswap/icons/master/token/${pool.rewardToken.symbol.toLowerCase()}.jpg`
          : `https://raw.githubusercontent.com/sushiswap/assets/master/blockchains/ethereum/assets/${getAddress(
              pool.rewarder.rewardToken
            )}/logo.png`

        const decimals = 10 ** pool.rewardToken.decimals

        const rewardPerBlock =
          pool.rewardToken.symbol === 'ALCX'
            ? pool.rewarder.rewardPerSecond / decimals
            : (pool.rewarder.rewardPerSecond / decimals) * averageBlockTime

        const rewardPerDay =
          pool.rewardToken.symbol === 'ALCX'
            ? (pool.rewarder.rewardPerSecond / decimals) * blocksPerDay
            : (pool.rewarder.rewardPerSecond / decimals) * averageBlockTime * blocksPerDay

        const reward = {
          token: pool.rewardToken.symbol,
          icon: icon,
          rewardPerBlock: rewardPerBlock,
          rewardPerDay: rewardPerDay,
          rewardPrice: pool.rewardToken.derivedETH * nativePrice,
        }

        rewards[1] = reward
      } else if (pool.chef === Chef.MINICHEF) {
        const sushiPerSecond = ((pool.allocPoint / pool.miniChef.totalAllocPoint) * pool.miniChef.sushiPerSecond) / 1e18
        const sushiPerBlock = sushiPerSecond * averageBlockTime
        const sushiPerDay = sushiPerBlock * blocksPerDay
        const rewardPerSecond =
          ((pool.allocPoint / pool.miniChef.totalAllocPoint) * pool.rewarder.rewardPerSecond) / 1e18
        const rewardPerBlock = rewardPerSecond * averageBlockTime
        const rewardPerDay = rewardPerBlock * blocksPerDay

        const reward = {
          [ChainId.MATIC]: {
            token: 'MATIC',
            icon: 'https://raw.githubusercontent.com/sushiswap/icons/master/token/polygon.jpg',
            rewardPrice: maticPrice,
            rewardPerBlock,
            rewardPerDay,
          },
          [ChainId.XDAI]: {
            token: 'STAKE',
            icon: 'https://raw.githubusercontent.com/sushiswap/icons/master/token/stake.jpg',
            rewardPerBlock,
            rewardPerDay,
            rewardPrice: stakePrice,
          },
          [ChainId.HARMONY]: {
            token: 'ONE',
            icon: 'https://raw.githubusercontent.com/sushiswap/icons/master/token/one.jpg',
            rewardPerBlock,
            rewardPerDay,
            rewardPrice: nativePrice, // Reward token = Native token
          },
        }

        rewards[0] = {
          ...defaultReward,
          rewardPerBlock: sushiPerBlock,
          rewardPerDay: sushiPerDay,
        }

        if (chainId in reward) {
          rewards[1] = reward[chainId]
        }
      }

      return rewards
    }

    const rewards = getRewards()

    const balance = swapPair ? Number(pool.balance / 1e18) : pool.balance / 10 ** kushoPair.token0.decimals

    const tvl = swapPair
      ? (balance / Number(swapPair.totalSupply)) * Number(swapPair.reserveUSD)
      : balance * kushoPair.token0.derivedETH * nativePrice

    const roiPerBlock =
      rewards.reduce((previousValue, currentValue) => {
        return previousValue + currentValue.rewardPerBlock * currentValue.rewardPrice
      }, 0) / tvl
    console.log({ rewards })
    const roiPerHour = roiPerBlock * blocksPerHour

    const roiPerDay = roiPerHour * 24

    const roiPerMonth = roiPerDay * 30

    const roiPerYear = roiPerMonth * 12

    const position = positions.find((position) => position.id === pool.id && position.chef === pool.chef)

    return {
      ...pool,
      ...position,
      pair: {
        ...pair,
        decimals: pair.type === PairType.KUSHO ? Number(pair.asset.tokenInfo.decimals) : 18,
        type,
      },
      balance,
      roiPerBlock,
      roiPerHour,
      roiPerDay,
      roiPerMonth,
      roiPerYear,
      rewards,
      tvl,
    }
  }

  return farms
    .filter((farm) => {
      return (
        (swapPairs && swapPairs.find((pair) => pair.id === farm.pair)) ||
        (kushoPairs && kushoPairs.find((pair) => pair.id === farm.pair))
      )
    })
    .map(map)
}
