// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

export type MetricLevel = 'low' | 'medium' | 'high' | 'very-high'

export interface MetricInterpretation {
  level: MetricLevel
  message: string
  description: string
}

export interface MetricThresholds {
  low: number
  medium: number
  high: number
}

/**
 * Get interpretation for Visual Change Rate (VCR)
 * VCR measures what percentage of the screen changed compared to the previous screenshot
 * Range: 0-1 (0% to 100%)
 */
export function interpretVCR(vcr: number): MetricInterpretation {
  if (vcr < 0.1) {
    return {
      level: 'low',
      message: 'Minimal change',
      description: 'The screen barely changed. You might be reading or viewing static content.'
    }
  } else if (vcr < 0.3) {
    return {
      level: 'medium',
      message: 'Moderate change',
      description: 'Some parts of the screen changed. You might be scrolling, typing, or navigating.'
    }
  } else if (vcr < 0.6) {
    return {
      level: 'high',
      message: 'Significant change',
      description: 'Large portions of the screen changed. You might have switched windows, opened a new page, or made major edits.'
    }
  } else {
    return {
      level: 'very-high',
      message: 'Major change',
      description: 'Most of the screen changed. You likely switched applications, opened a new document, or navigated to a completely different page.'
    }
  }
}

/**
 * Get interpretation for Mean Absolute Frame Difference (MAFD)
 * MAFD measures the average intensity of pixel changes
 * Range: 0-1 (0 = no change, 1 = maximum change)
 */
export function interpretMAFD(mafd: number): MetricInterpretation {
  if (mafd < 0.05) {
    return {
      level: 'low',
      message: 'Subtle change',
      description: 'Very small pixel-level changes. Likely just cursor movement or minor UI updates.'
    }
  } else if (mafd < 0.15) {
    return {
      level: 'medium',
      message: 'Noticeable change',
      description: 'Moderate pixel changes. Could be scrolling, typing, or small interface updates.'
    }
  } else if (mafd < 0.3) {
    return {
      level: 'high',
      message: 'Substantial change',
      description: 'Significant pixel-level changes. Likely content updates, window switches, or major UI changes.'
    }
  } else {
    return {
      level: 'very-high',
      message: 'Dramatic change',
      description: 'Major pixel-level changes. Probably a full page transition, application switch, or large content replacement.'
    }
  }
}

/**
 * Get interpretation for Screen Entropy (SE)
 * SE measures the information complexity/diversity of the screen
 * Range: typically 0-8 (higher = more complex/diverse)
 */
export function interpretSE(se: number): MetricInterpretation {
  if (se < 3) {
    return {
      level: 'low',
      message: 'Simple screen',
      description: 'The screen has low complexity. It might be mostly blank, a single color, or very uniform content.'
    }
  } else if (se < 5) {
    return {
      level: 'medium',
      message: 'Moderate complexity',
      description: 'The screen has moderate complexity. Typical for documents, code editors, or simple interfaces.'
    }
  } else if (se < 7) {
    return {
      level: 'high',
      message: 'Complex screen',
      description: 'The screen has high complexity. Could be a busy interface, multiple windows, or rich content.'
    }
  } else {
    return {
      level: 'very-high',
      message: 'Very complex screen',
      description: 'The screen has very high complexity. Likely multiple applications, rich media, or dense information displays.'
    }
  }
}

/**
 * Get interpretation for Edge Density (ED)
 * ED measures the percentage of pixels that are edges (details/features)
 * Range: 0-1 (0% to 100%)
 */
export function interpretED(ed: number): MetricInterpretation {
  if (ed < 0.1) {
    return {
      level: 'low',
      message: 'Few details',
      description: 'The screen has few edges or details. Might be mostly text, solid colors, or simple graphics.'
    }
  } else if (ed < 0.2) {
    return {
      level: 'medium',
      message: 'Moderate details',
      description: 'The screen has moderate detail. Typical for documents, code, or standard interfaces.'
    }
  } else if (ed < 0.35) {
    return {
      level: 'high',
      message: 'Rich details',
      description: 'The screen has many details. Could include images, complex graphics, or detailed interfaces.'
    }
  } else {
    return {
      level: 'very-high',
      message: 'Very rich details',
      description: 'The screen has very high detail density. Likely contains images, complex graphics, or highly detailed content.'
    }
  }
}

/**
 * Get interpretation for Token Count (TC/OT)
 * TC measures the number of text tokens extracted from the screen
 * Range: 0+ (higher = more text)
 */
export function interpretTC(tc: number): MetricInterpretation {
  if (tc < 20) {
    return {
      level: 'low',
      message: 'Little text',
      description: 'Very little text on screen. Might be a simple interface, image, or mostly blank screen.'
    }
  } else if (tc < 100) {
    return {
      level: 'medium',
      message: 'Moderate text',
      description: 'Moderate amount of text. Typical for code editors, documents, or standard interfaces.'
    }
  } else if (tc < 300) {
    return {
      level: 'high',
      message: 'Lots of text',
      description: 'Large amount of text. Could be a long document, article, or text-heavy interface.'
    }
  } else {
    return {
      level: 'very-high',
      message: 'Very text-heavy',
      description: 'Very large amount of text. Likely a long document, article, or dense text content.'
    }
  }
}

/**
 * Get interpretation for Text Density (TD)
 * TD measures tokens per 1000 pixels (normalized text load)
 * Range: typically 0.01 - 10 (tokens per 1000 pixels)
 */
export function interpretTD(td: number): MetricInterpretation {
  if (td < 0.1) {
    return {
      level: 'low',
      message: 'Low text density',
      description: 'Text is sparse relative to screen size. Screen might have large images or whitespace.'
    }
  } else if (td < 0.5) {
    return {
      level: 'medium',
      message: 'Moderate text density',
      description: 'Text density is moderate. Typical for balanced layouts with text and other content.'
    }
  } else if (td < 2.0) {
    return {
      level: 'high',
      message: 'High text density',
      description: 'Text is dense relative to screen size. Likely a text-heavy document or interface.'
    }
  } else {
    return {
      level: 'very-high',
      message: 'Very high text density',
      description: 'Text is very dense. Screen is likely dominated by text content with little whitespace.'
    }
  }
}

/**
 * Get interpretation for Text Change Rate (TCR)
 * TCR measures how much the text content changed compared to previous screenshot
 * Range: 0-1+ (0 = no change, 1+ = complete change)
 */
export function interpretTCR(tcr: number): MetricInterpretation {
  if (tcr < 0.1) {
    return {
      level: 'low',
      message: 'Text mostly unchanged',
      description: 'The text content is very similar. You might be reading or viewing static text.'
    }
  } else if (tcr < 0.3) {
    return {
      level: 'medium',
      message: 'Some text changed',
      description: 'Some text changed. Could be scrolling, minor edits, or small content updates.'
    }
  } else if (tcr < 0.6) {
    return {
      level: 'high',
      message: 'Significant text change',
      description: 'Much of the text changed. You might be writing, editing, or navigating to new content.'
    }
  } else {
    return {
      level: 'very-high',
      message: 'Major text change',
      description: 'Most or all text changed. Likely opened a new document, switched pages, or made major edits.'
    }
  }
}

/**
 * Get interpretation for Net Writing Rate (NWR)
 * NWR measures how fast you are adding new text (tokens per second)
 * Range: 0+ (higher = faster writing)
 */
export function interpretNWR(nwr: number): MetricInterpretation {
  if (nwr < 1) {
    return {
      level: 'low',
      message: 'Slow or no writing',
      description: 'Very little or no new text is being added. You might be reading, thinking, or paused.'
    }
  } else if (nwr < 5) {
    return {
      level: 'medium',
      message: 'Moderate writing speed',
      description: 'Text is being added at a moderate pace. Typical typing or editing speed.'
    }
  } else if (nwr < 15) {
    return {
      level: 'high',
      message: 'Fast writing',
      description: 'Text is being added quickly. You might be actively typing, coding, or writing.'
    }
  } else {
    return {
      level: 'very-high',
      message: 'Very fast writing',
      description: 'Text is being added very quickly. Could be rapid typing, copy-paste, or bulk content addition.'
    }
  }
}

/**
 * Get interpretation for Context Switch Count (CSC)
 * CSC indicates whether the context/topic changed (0 = same, 1 = switched)
 */
export function interpretCSC(csc: number): MetricInterpretation {
  if (csc === 0) {
    return {
      level: 'low',
      message: 'Same context',
      description: 'You are still working on the same topic or in the same application.'
    }
  } else {
    return {
      level: 'high',
      message: 'Context switched',
      description: 'You switched to a different topic, application, or task.'
    }
  }
}

/**
 * Get interpretation for Semantic Coherence (SC)
 * SC measures how semantically similar consecutive screenshots are
 * Range: 0-1 (0 = completely different, 1 = very similar)
 */
export function interpretSC(sc: number): MetricInterpretation {
  if (sc < 0.3) {
    return {
      level: 'low',
      message: 'Different topic',
      description: 'The screenshots are about different topics. You likely switched tasks or contexts.'
    }
  } else if (sc < 0.6) {
    return {
      level: 'medium',
      message: 'Related topic',
      description: 'The screenshots are somewhat related. You might be working on related but different aspects.'
    }
  } else if (sc < 0.8) {
    return {
      level: 'high',
      message: 'Similar topic',
      description: 'The screenshots are about similar topics. You are likely continuing the same task.'
    }
  } else {
    return {
      level: 'very-high',
      message: 'Very similar topic',
      description: 'The screenshots are very similar in topic. You are likely viewing or working on the same content.'
    }
  }
}

/**
 * Get color class for metric level
 */
export function getLevelColorClass(level: MetricLevel): string {
  switch (level) {
    case 'low':
      return 'text-gray-600'
    case 'medium':
      return 'text-blue-600'
    case 'high':
      return 'text-orange-600'
    case 'very-high':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}

/**
 * Get background color class for metric level
 */
export function getLevelBgColorClass(level: MetricLevel): string {
  switch (level) {
    case 'low':
      return 'bg-gray-50'
    case 'medium':
      return 'bg-blue-50'
    case 'high':
      return 'bg-orange-50'
    case 'very-high':
      return 'bg-red-50'
    default:
      return 'bg-gray-50'
  }
}

