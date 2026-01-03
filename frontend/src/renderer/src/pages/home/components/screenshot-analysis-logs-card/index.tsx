// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import { FC, useState, useRef } from 'react'
import { CardLayout } from '../layout'
import { useMount, useUnmount } from 'ahooks'
import { Typography, Button, Image, Tooltip } from '@arco-design/web-react'
import axiosInstance from '@renderer/services/axiosConfig'
import dayjs from 'dayjs'
import { IconDown, IconUp, IconRefresh } from '@arco-design/web-react/icon'
import { pathToFileURL } from '@renderer/utils/file'
import {
  interpretVCR,
  interpretMAFD,
  interpretSE,
  interpretED,
  interpretTC,
  interpretTD,
  interpretTCR,
  interpretNWR,
  interpretCSC,
  interpretSC,
  getLevelColorClass
} from './metrics-thresholds'

const { Text } = Typography

interface MetricItemProps {
  label: string
  value: string
  interpretation: {
    level: 'low' | 'medium' | 'high' | 'very-high'
    message: string
    description: string
  }
}

const MetricItem: FC<MetricItemProps> = ({ label, value, interpretation }) => {
  const colorClass = getLevelColorClass(interpretation.level)
  return (
    <div className="p-2 bg-white rounded border border-gray-200">
      <div className="flex items-start justify-between gap-2 mb-1">
        <Text className="text-xs font-semibold text-gray-700">{label}</Text>
        <span className={`text-xs font-mono font-semibold ${colorClass}`}>{value}</span>
      </div>
      <Tooltip content={interpretation.description}>
        <div className="flex items-center gap-1 cursor-help">
          <span className={`text-xs font-medium ${colorClass}`}>{interpretation.message}</span>
        </div>
      </Tooltip>
      <Text className="text-[10px] text-gray-500 mt-1 block">{interpretation.description}</Text>
    </div>
  )
}

interface UserProfile {
  age?: string
  gender?: string
  socioeconomic_status?: string
}

interface ScreenshotAnalysisLog {
  raw_resp: any
  screenshot_path: string
  timestamp: string
  metrics?: {
    vcr?: number | null
    mafd?: number | null
    se?: number | null
    ed?: number | null
    ot?: number | null
    td?: number | null
    tcr?: number | null
    nwr?: number | null
    context?: string | null
    csc?: number | null
    sc?: number | null
  }
}

const ScreenshotAnalysisLogsCard: FC = () => {
  const [logs, setLogs] = useState<ScreenshotAnalysisLog[]>([])
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

  const extractSummaries = (raw_resp: any): string => {
    if (!raw_resp || !raw_resp.items || !Array.isArray(raw_resp.items)) {
      return ''
    }

    const summaries: string[] = []
    for (const item of raw_resp.items) {
      if (item && typeof item === 'object') {
        // Check if summary is in item.data.summary or item.summary
        const summary = item.data?.summary || item.summary
        if (summary && typeof summary === 'string' && summary.trim()) {
          summaries.push(summary.trim())
        }
      }
    }

    return summaries.join(' ')
  }

  const extractUserProfile = (raw_resp: any): UserProfile | null => {
    if (!raw_resp || !raw_resp.items || !Array.isArray(raw_resp.items)) {
      return null
    }

    // Get user_profile from the first item (assuming all items have the same user profile)
    const firstItem = raw_resp.items[0]
    if (firstItem && typeof firstItem === 'object') {
      const userProfile = firstItem.data?.user_profile || firstItem.user_profile
      if (userProfile && typeof userProfile === 'object') {
        return {
          age: userProfile.age || '未知',
          gender: userProfile.gender || '未知',
          socioeconomic_status: userProfile.socioeconomic_status || '未知'
        }
      }
    }

    return null
  }

  const extractAICollaboration = (raw_resp: any): string | null => {
    if (!raw_resp || !raw_resp.items || !Array.isArray(raw_resp.items)) {
      return null
    }

    const firstItem = raw_resp.items[0]
    if (firstItem && typeof firstItem === 'object') {
      const aiCollab = firstItem.data?.ai_collaboration || firstItem.ai_collaboration
      if (aiCollab === 'yes' || aiCollab === 'no') {
        return aiCollab
      }
    }

    return null
  }

  const extractInteractionType = (raw_resp: any): string | null => {
    if (!raw_resp || !raw_resp.items || !Array.isArray(raw_resp.items)) {
      return null
    }

    const firstItem = raw_resp.items[0]
    if (firstItem && typeof firstItem === 'object') {
      const interactionType = firstItem.data?.interaction_type || firstItem.interaction_type
      if (interactionType && typeof interactionType === 'string') {
        return interactionType
      }
    }

    return null
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
      title="Screenshot Analysis & VLM Logs"
      emptyText="No logs yet. Screenshots will be processed and logged here."
      isEmpty={logs.length === 0}
      height="h-[600px]">
      <div className="flex flex-col gap-2 w-full">
        <div className="flex justify-end mb-2">
          <Button size="small" icon={<IconRefresh />} onClick={fetchLogs} loading={loading} type="text">
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
                          preview={true}
                        />
                      </div>
                    )}
                    {/* Timestamp and path */}
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Text className="text-xs text-gray-600">{formatTimestamp(log.timestamp)}</Text>
                        {log.metrics && Object.keys(log.metrics).length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Metrics</span>
                        )}
                      </div>
                      <Text className="text-xs text-gray-500 truncate" title={log.screenshot_path}>
                        {log.screenshot_path}
                      </Text>
                    </div>
                  </div>
                  <div className="ml-2 flex-shrink-0">{isExpanded ? <IconUp /> : <IconDown />}</div>
                </div>
                {isExpanded && (
                  <div className="mt-2 space-y-3">
                    {/* User Profile & AI Collaboration Info */}
                    {(() => {
                      const userProfile = extractUserProfile(log.raw_resp)
                      const aiCollaboration = extractAICollaboration(log.raw_resp)
                      const interactionType = extractInteractionType(log.raw_resp)
                      
                      if (userProfile || aiCollaboration || interactionType) {
                        return (
                          <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded border border-purple-200">
                            <Text className="text-xs font-semibold text-purple-900 mb-3 block">Analysis Overview</Text>
                            
                            {/* User Profile */}
                            {userProfile && (
                              <div className="mb-3 p-2 bg-white rounded border border-purple-100">
                                <Text className="text-[10px] font-semibold text-purple-800 mb-2 block">User Profile</Text>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Text className="text-[10px] text-gray-600">Age:</Text>
                                    <Text className="text-xs font-medium text-gray-800 ml-1">{userProfile.age}</Text>
                                  </div>
                                  <div>
                                    <Text className="text-[10px] text-gray-600">Gender:</Text>
                                    <Text className="text-xs font-medium text-gray-800 ml-1">{userProfile.gender}</Text>
                                  </div>
                                  <div>
                                    <Text className="text-[10px] text-gray-600">SES:</Text>
                                    <Text className="text-xs font-medium text-gray-800 ml-1">{userProfile.socioeconomic_status}</Text>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* AI Collaboration */}
                            {aiCollaboration && (
                              <div className="mb-3 p-2 bg-white rounded border border-purple-100">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <Text className="text-[10px] font-semibold text-purple-800 mb-1 block">AI Collaboration</Text>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                        aiCollaboration === 'yes' 
                                          ? 'bg-green-100 text-green-700' 
                                          : 'bg-gray-100 text-gray-700'
                                      }`}>
                                        {aiCollaboration === 'yes' ? 'Yes' : 'No'}
                                      </span>
                                      {aiCollaboration === 'yes' && interactionType && (
                                        <div className="flex items-center gap-1">
                                          <Text className="text-[10px] text-gray-600">Type:</Text>
                                          <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                            {interactionType}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      }
                      return null
                    })()}
                    
                    {/* Metrics Display */}
                    {log.metrics && Object.keys(log.metrics).length > 0 && (
                      <div className="p-2 bg-blue-50 rounded border border-blue-200">
                        <Text className="text-xs font-semibold text-blue-900 mb-2 block">Screenshot Metrics</Text>
                        {/* VLM Summaries */}
                        {(() => {
                          const summaries = extractSummaries(log.raw_resp)
                          return summaries ? (
                            <div className="mb-3 p-2 bg-white rounded border border-blue-300">
                              <Text className="text-[10px] font-semibold text-blue-800 mb-1 block">VLM Summary:</Text>
                              <Text className="text-xs text-gray-700 leading-relaxed">{summaries}</Text>
                            </div>
                          ) : null
                        })()}
                        <div className="grid grid-cols-1 gap-3">
                          {/* Visual Metrics */}
                          {log.metrics.vcr !== null && log.metrics.vcr !== undefined && (
                            <MetricItem
                              label="Visual Change Rate (VCR)"
                              value={`${(log.metrics.vcr * 100).toFixed(2)}%`}
                              interpretation={interpretVCR(log.metrics.vcr)}
                            />
                          )}
                          {log.metrics.mafd !== null && log.metrics.mafd !== undefined && (
                            <MetricItem
                              label="Mean Absolute Frame Diff (MAFD)"
                              value={log.metrics.mafd.toFixed(4)}
                              interpretation={interpretMAFD(log.metrics.mafd)}
                            />
                          )}
                          {log.metrics.se !== null && log.metrics.se !== undefined && (
                            <MetricItem
                              label="Screen Entropy (SE)"
                              value={log.metrics.se.toFixed(2)}
                              interpretation={interpretSE(log.metrics.se)}
                            />
                          )}
                          {log.metrics.ed !== null && log.metrics.ed !== undefined && (
                            <MetricItem
                              label="Edge Density (ED)"
                              value={`${(log.metrics.ed * 100).toFixed(2)}%`}
                              interpretation={interpretED(log.metrics.ed)}
                            />
                          )}
                          {/* Text Metrics */}
                          {log.metrics.ot !== null && log.metrics.ot !== undefined && (
                            <MetricItem
                              label="Token Count (TC)"
                              value={log.metrics.ot.toString()}
                              interpretation={interpretTC(log.metrics.ot)}
                            />
                          )}
                          {log.metrics.td !== null && log.metrics.td !== undefined && (
                            <MetricItem
                              label="Text Density (TD)"
                              value={log.metrics.td > 0 ? log.metrics.td.toFixed(3) : '0.000'}
                              interpretation={interpretTD(log.metrics.td)}
                            />
                          )}
                          {log.metrics.tcr !== null && log.metrics.tcr !== undefined && (
                            <MetricItem
                              label="Text Change Rate (TCR)"
                              value={log.metrics.tcr.toFixed(3)}
                              interpretation={interpretTCR(log.metrics.tcr)}
                            />
                          )}
                          {log.metrics.nwr !== null && log.metrics.nwr !== undefined && (
                            <MetricItem
                              label="Net Writing Rate (NWR)"
                              value={`${log.metrics.nwr.toFixed(2)} tokens/sec`}
                              interpretation={interpretNWR(log.metrics.nwr)}
                            />
                          )}
                          {/* Context Metrics */}
                          {log.metrics.csc !== null && log.metrics.csc !== undefined && (
                            <MetricItem
                              label="Context Switched (CSC)"
                              value={log.metrics.csc === 1 ? 'Yes' : 'No'}
                              interpretation={interpretCSC(log.metrics.csc)}
                            />
                          )}
                          {/* Semantic Metrics */}
                          {log.metrics.sc !== null && log.metrics.sc !== undefined && (
                            <MetricItem
                              label="Semantic Coherence (SC)"
                              value={log.metrics.sc.toFixed(3)}
                              interpretation={interpretSC(log.metrics.sc)}
                            />
                          )}
                        </div>
                      </div>
                    )}
                    {/* Raw Response JSON */}
                    <div className="p-2 bg-white rounded border border-gray-200">
                      <Text className="text-xs font-semibold text-gray-700 mb-2 block">VLM Raw Response</Text>
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(log.raw_resp, null, 2)}
                      </pre>
                    </div>
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

export { ScreenshotAnalysisLogsCard }
