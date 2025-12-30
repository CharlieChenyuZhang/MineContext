// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import React from 'react'
import { Typography } from '@arco-design/web-react'
import './analysis-page.css'
import { RawRespLogsCard } from '../home/components/raw-resp-logs-card'

const { Title, Text } = Typography

const AnalysisPage: React.FC = () => {
  return (
    <div className="flex flex-row h-full">
      <div style={{ height: '8px', appRegion: 'drag' } as React.CSSProperties} />
      <div className="relative pb-2 h-full w-full overflow-hidden flex flex-col">
        <div className="bg-white rounded-2xl h-full overflow-y-auto overflow-x-hidden pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex w-full pt-5 px-4 pb-3 flex-col items-start gap-4 flex-shrink-0">
            <div className="flex justify-between items-start self-stretch w-full">
              <div className="rounded-xl w-full flex justify-between items-start">
                <div className="flex flex-col items-start gap-2">
                  <Title heading={3} style={{ marginTop: 5, fontWeight: 700, fontSize: 24 }}>
                    Analysis
                  </Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    View VLM raw response logs and analysis data
                  </Text>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 flex-1 self-stretch">
              <div className="flex flex-col items-start gap-3 flex-1 self-stretch">
                <RawRespLogsCard />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnalysisPage
