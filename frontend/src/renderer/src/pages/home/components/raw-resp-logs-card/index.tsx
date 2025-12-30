// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import { FC, useState, useEffect, useRef } from 'react'
import { CardLayout } from '../layout'
import { useMount, useUnmount } from 'ahooks'
import { Typography, Collapse, Button, Space, Image } from '@arco-design/web-react'
import axiosInstance from '@renderer/services/axiosConfig'
import dayjs from 'dayjs'
import { IconDown, IconUp, IconRefresh } from '@arco-design/web-react/icon'
import { pathToFileURL } from '@renderer/utils/file'

const { Text } = Typography
const CollapseItem = Collapse.Item

interface RawRespLog {
  raw_resp: any
  screenshot_path: string
  timestamp: string
}

const RawRespLogsCard: FC = () => {
  const [logs, setLogs] = useState<RawRespLog[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const response = await axiosInstance.get('/api/screenshot_raw_resp_logs', {
        params: { limit: 20 }
      })
      if (response.data && response.data.data) {
        setLogs(response.data.data.reverse()) // Show newest first
      }
    } catch (error) {
      console.error('Failed to fetch raw_resp logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key)
      } else {
        return [...prev, key]
      }
    })
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
    } catch {
      return timestamp
    }
  }

  useMount(() => {
    fetchLogs()
    // Poll every 3 seconds for new logs
    pollIntervalRef.current = setInterval(() => {
      fetchLogs()
    }, 3000)
  })

  useUnmount(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  })

  return (
    <CardLayout
      title="VLM Raw Response Logs"
      emptyText="No logs yet. Screenshots will be processed and logged here."
      isEmpty={logs.length === 0}
      height="h-[600px]">
      <div className="flex flex-col gap-2 w-full">
        <div className="flex justify-end mb-2">
          <Button
            size="small"
            icon={<IconRefresh />}
            onClick={fetchLogs}
            loading={loading}
            type="text">
            Refresh
          </Button>
        </div>
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {logs.map((log, index) => {
            const key = `log-${index}-${log.timestamp}`
            const isExpanded = expandedKeys.includes(key)
            return (
              <div
                key={key}
                className="border border-gray-200 rounded p-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                <div
                  className="flex items-start justify-between cursor-pointer gap-3"
                  onClick={() => toggleExpand(key)}>
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Screenshot thumbnail */}
                    {log.screenshot_path && (
                      <div className="flex-shrink-0">
                        <Image
                          src={pathToFileURL(log.screenshot_path)}
                          width={80}
                          height={60}
                          alt="Screenshot"
                          className="cursor-pointer rounded-[6px] overflow-hidden object-cover"
                          preview={{
                            mask: 'Preview'
                          }}
                        />
                      </div>
                    )}
                    {/* Timestamp and path */}
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <Text className="text-xs text-gray-600">
                        {formatTimestamp(log.timestamp)}
                      </Text>
                      <Text className="text-xs text-gray-500 truncate" title={log.screenshot_path}>
                        {log.screenshot_path}
                      </Text>
                    </div>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    {isExpanded ? <IconUp /> : <IconDown />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(log.raw_resp, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </CardLayout>
  )
}

export { RawRespLogsCard }

