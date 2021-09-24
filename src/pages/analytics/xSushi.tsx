import { ChainId, PICHI_ADDRESS } from '@polycity/sdk'
import React, { useMemo } from 'react'
import ScrollableGraph from '../../components/ScrollableGraph'
import AnalyticsContainer from '../../features/analytics/AnalyticsContainer'
import Background from '../../features/analytics/Background'
import InfoCard from '../../features/analytics/Bar/InfoCard'
import { classNames, formatNumber, formatPercent } from '../../functions'
import { aprToApy } from '../../functions/convert/apyApr'
import {
  useBlock,
  useDayData,
  useEthPrice,
  useFactory,
  useNativePrice,
  useTokenDayData,
  useTokens,
} from '../../services/graph'
import { useBar, useBarHistory } from '../../services/graph/hooks/bar'
import ColoredNumber from '../../features/analytics/ColoredNumber'
import { XPICHI } from '../../config/tokens'

export default function XPichi() {
  const block1d = useBlock({ daysAgo: 1, chainId: ChainId.MAINNET })

  const exchange = useFactory({ chainId: ChainId.MAINNET })
  const exchange1d = useFactory({ block: block1d, chainId: ChainId.MAINNET })

  const dayData = useDayData()

  const ethPrice = useNativePrice({ chainId: ChainId.MAINNET })
  const ethPrice1d = useNativePrice({ block: block1d, chainId: ChainId.MAINNET, shouldFetch: !!block1d })

  const xPichi = useTokens({ chainId: ChainId.MAINNET, subset: [XPICHI.address] })?.[0]
  const xPichi1d = useTokens({ block: block1d, chainId: ChainId.MAINNET, subset: [XPICHI.address] })?.[0]
  const sushiDayData = useTokenDayData({ token: PICHI_ADDRESS['1'], chainId: ChainId.MAINNET })

  const bar = useBar()
  const bar1d = useBar({ block: block1d, shouldFetch: !!block1d })
  const barHistory = useBarHistory()

  const [xPichiPrice, xPichiMarketcap] = [
    xPichi?.derivedETH * ethPrice,
    xPichi?.derivedETH * ethPrice * bar?.totalSupply,
  ]

  const [xPichiPrice1d, xPichiMarketcap1d] = [
    xPichi1d?.derivedETH * ethPrice1d,
    xPichi1d?.derivedETH * ethPrice1d * bar1d?.totalSupply,
  ]

  const data = useMemo(
    () =>
      barHistory && dayData && sushiDayData && bar
        ? barHistory.map((barDay) => {
            const exchangeDay = dayData.find((day) => day.date === barDay.date)
            const sushiDay = sushiDayData.find((day) => day.date === barDay.date)

            const totalPichiStakedUSD = barDay.xPichiSupply * barDay.ratio * sushiDay.priceUSD

            const APR =
              totalPichiStakedUSD !== 0 ? ((exchangeDay.volumeUSD * 0.0005 * 365) / totalPichiStakedUSD) * 100 : 0

            return {
              APR: APR,
              APY: aprToApy(APR, 365),
              xPichiSupply: barDay.xPichiSupply,
              date: barDay.date,
              feesReceived: exchangeDay.volumeUSD * 0.0005,
              sushiStakedUSD: barDay.sushiStakedUSD,
              sushiHarvestedUSD: barDay.sushiHarvestedUSD,
            }
          })
        : [],
    [barHistory, dayData, sushiDayData, bar]
  )

  const APY1d = aprToApy(
    (((exchange?.volumeUSD - exchange1d?.volumeUSD) * 0.0005 * 365.25) / (bar?.totalSupply * xPichiPrice)) * 100 ?? 0
  )
  const APY1w = aprToApy(data.slice(-7).reduce((acc, day) => (acc += day.APY), 0) / 7)

  const graphs = useMemo(
    () => [
      {
        labels: ['APY', 'APR'],
        data: [
          data.map((d) => ({
            date: d.date * 1000,
            value: d.APY,
          })),
          data.map((d) => ({
            date: d.date * 1000,
            value: d.APR,
          })),
        ],
      },
      {
        title: 'Fees received (USD)',
        data: [
          data.map((d) => ({
            date: d.date * 1000,
            value: d.feesReceived,
          })),
        ],
      },
      {
        labels: ['Pichi Staked (USD)', 'Pichi Harvested (USD)'],
        note: '/ day',
        data: [
          data.map((d) => ({
            date: d.date * 1000,
            value: d.sushiStakedUSD,
          })),
          data.map((d) => ({
            date: d.date * 1000,
            value: d.sushiHarvestedUSD,
          })),
        ],
      },
      {
        title: 'xPichi Total Supply',
        data: [
          data.map((d) => ({
            date: d.date * 1000,
            value: d.xPichiSupply,
          })),
        ],
      },
    ],
    [data]
  )

  return (
    <AnalyticsContainer>
      <Background background="bar">
        <div className="grid items-center justify-between grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
          <div className="space-y-5">
            <div className="text-3xl font-bold text-high-emphesis">xPichi</div>
            <div>Find out all about xPichi here.</div>
          </div>
          <div className="flex space-x-12">
            <div className="flex flex-col">
              <div>Price</div>
              <div className="flex items-center space-x-2">
                <div className="text-lg font-medium text-high-emphesis">{formatNumber(xPichiPrice ?? 0, true)}</div>
                <ColoredNumber number={(xPichiPrice / xPichiPrice1d) * 100 - 100} percent={true} />
              </div>
            </div>
            <div className="flex flex-col">
              <div>Market Cap</div>
              <div className="flex items-center space-x-2">
                <div className="text-lg font-medium text-high-emphesis">
                  {formatNumber(xPichiMarketcap ?? 0, true, false)}
                </div>
                <ColoredNumber number={(xPichiMarketcap / xPichiMarketcap1d) * 100 - 100} percent={true} />
              </div>
            </div>
          </div>
        </div>
      </Background>
      <div className="pt-4 space-y-5 lg:px-14">
        <div className="flex flex-row space-x-4 overflow-auto">
          <InfoCard text="APY (Last 24 Hours)" number={formatPercent(APY1d)} />
          <InfoCard text="APY (Last 7 Days)" number={formatPercent(APY1w)} />
          <InfoCard text="xPICHI Supply" number={formatNumber(bar?.totalSupply)} />
          <InfoCard text="xPICHI : PICHI" number={Number(bar?.ratio ?? 0)?.toFixed(4)} />
        </div>
        <div className="space-y-4">
          {graphs.map((graph, i) => (
            <div
              className={classNames(
                graph.data[0].length === 0 && 'hidden',
                'p-1 rounded bg-dark-900 border border-dark-700'
              )}
              key={i}
            >
              <div className="w-full h-96">
                <ScrollableGraph
                  labels={graph.labels}
                  title={graph.title}
                  note={graph.note}
                  data={graph.data}
                  margin={{ top: 64, right: 32, bottom: 16, left: 64 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnalyticsContainer>
  )
}
