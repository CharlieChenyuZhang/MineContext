#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
# SPDX-License-Identifier: Apache-2.0

"""
Screenshot Metrics Calculator

Calculates various metrics from screenshots based on the metrics specification.
Each function is clearly documented with what it calculates.
"""

import numpy as np
from PIL import Image
from typing import Optional, Dict, Any, Tuple, List
import re
from opencontext.utils.logging_utils import get_logger

logger = get_logger(__name__)


def preprocess_image(image_path: str, target_size: Optional[Tuple[int, int]] = None, blur_sigma: float = 0.0) -> Optional[np.ndarray]:
    """
    Preprocess image: load, downsample, convert to grayscale, optionally blur.
    
    Args:
        image_path: Path to the image file
        target_size: Target size (width, height) for downsampling. If None, uses original size.
        blur_sigma: Gaussian blur sigma (0.0 = no blur)
    
    Returns:
        Preprocessed grayscale image as numpy array [0, 1], or None if error
    """
    try:
        with Image.open(image_path) as img:
            # Convert to RGB if needed
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Downsample if target_size is provided
            if target_size:
                img = img.resize(target_size, Image.Resampling.BILINEAR)
            
            # Convert to grayscale
            gray = img.convert('L')
            
            # Convert to numpy array [0, 1]
            gray_array = np.array(gray, dtype=np.float32) / 255.0
            
            # Apply Gaussian blur if sigma > 0
            if blur_sigma > 0:
                try:
                    from scipy import ndimage
                    gray_array = ndimage.gaussian_filter(gray_array, sigma=blur_sigma)
                except ImportError:
                    logger.warning("scipy not available, skipping blur")
            
            return gray_array
    except Exception as e:
        logger.error(f"Error preprocessing image {image_path}: {e}")
        return None


def calculate_vcr(current_frame: np.ndarray, previous_frame: Optional[np.ndarray], threshold: float = 0.05) -> Optional[float]:
    """
    Calculate Visual Change Rate (VCR).
    
    Measures the fraction of pixels that changed between two frames.
    A proxy for screen turbulence, often correlated with rapid context changes.
    
    Args:
        current_frame: Current grayscale frame [0, 1]
        previous_frame: Previous grayscale frame [0, 1], or None if not available
        threshold: Threshold for considering a pixel as "changed" (default: 0.05)
    
    Returns:
        VCR value [0, 1] representing fraction of changed pixels, or None if previous_frame is None
    """
    if previous_frame is None:
        return None
    
    if current_frame.shape != previous_frame.shape:
        logger.warning("Frame shapes don't match, cannot calculate VCR")
        return None
    
    # Calculate per-pixel absolute difference
    diff = np.abs(current_frame - previous_frame)
    
    # Create binary change mask
    change_mask = diff > threshold
    
    # Calculate fraction of changed pixels
    vcr = np.mean(change_mask.astype(float))
    
    return float(vcr)


def calculate_mafd(current_frame: np.ndarray, previous_frame: Optional[np.ndarray]) -> Optional[float]:
    """
    Calculate Mean Absolute Frame Difference (MAFD).
    
    Captures change magnitude, not only the area of change.
    Useful to separate subtle cursor movement from full-page transitions.
    
    Args:
        current_frame: Current grayscale frame [0, 1]
        previous_frame: Previous grayscale frame [0, 1], or None if not available
    
    Returns:
        MAFD value representing average absolute difference per pixel, or None if previous_frame is None
    """
    if previous_frame is None:
        return None
    
    if current_frame.shape != previous_frame.shape:
        logger.warning("Frame shapes don't match, cannot calculate MAFD")
        return None
    
    # Calculate per-pixel absolute difference
    diff = np.abs(current_frame - previous_frame)
    
    # Average over all pixels
    mafd = np.mean(diff)
    
    return float(mafd)


def calculate_se(frame: np.ndarray, bins: int = 64) -> float:
    """
    Calculate Screen Entropy (SE).
    
    A proxy for visual complexity and clutter, related to cognitive load.
    Uses Shannon entropy of pixel intensity histogram.
    
    Args:
        frame: Grayscale frame [0, 1]
        bins: Number of histogram bins (default: 64)
    
    Returns:
        SE value (Shannon entropy in bits)
    """
    # Build histogram of intensities
    hist, _ = np.histogram(frame.flatten(), bins=bins, range=(0.0, 1.0))
    
    # Normalize to probabilities
    hist = hist.astype(float)
    total = np.sum(hist)
    if total == 0:
        return 0.0
    
    probs = hist / total
    
    # Compute Shannon entropy
    # Add small epsilon to avoid log(0)
    epsilon = 1e-10
    entropy = -np.sum(probs * np.log2(probs + epsilon))
    
    return float(entropy)


def calculate_ed(frame: np.ndarray, percentile_threshold: float = 85.0) -> float:
    """
    Calculate Edge Density (ED).
    
    Text-heavy or UI-heavy screens tend to have higher edge density.
    Useful for estimating information density.
    
    Args:
        frame: Grayscale frame [0, 1]
        percentile_threshold: Percentile of gradient magnitudes to use as threshold (default: 85th)
    
    Returns:
        ED value [0, 1] representing fraction of pixels with strong edges
    """
    # Compute gradient magnitude using Sobel filters
    try:
        from scipy import ndimage
        
        # Sobel filters for gradients
        sobel_x = ndimage.sobel(frame, axis=1)
        sobel_y = ndimage.sobel(frame, axis=0)
    except ImportError:
        logger.warning("scipy not available, using simple gradient approximation")
        # Simple gradient approximation without scipy
        sobel_x = np.diff(frame, axis=1, prepend=frame[:, :1])
        sobel_y = np.diff(frame, axis=0, prepend=frame[:1, :])
    
    # Gradient magnitude
    gradient_magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
    
    # Use percentile as threshold (self-calibrating)
    threshold = np.percentile(gradient_magnitude, percentile_threshold)
    
    # Count pixels with gradient above threshold
    edge_mask = gradient_magnitude > threshold
    
    # Calculate fraction of edge pixels
    ed = np.mean(edge_mask.astype(float))
    
    return float(ed)


def calculate_all_metrics(
    current_image_path: str,
    previous_image_path: Optional[str] = None,
    target_size: Optional[Tuple[int, int]] = (320, 180),
    blur_sigma: float = 0.5,
    vcr_threshold: float = 0.05,
    ed_percentile: float = 85.0,
    se_bins: int = 64
) -> Dict[str, Any]:
    """
    Calculate all available metrics for a screenshot.
    
    Args:
        current_image_path: Path to current screenshot
        previous_image_path: Path to previous screenshot (for change-based metrics)
        target_size: Target size for downsampling (width, height)
        blur_sigma: Gaussian blur sigma
        vcr_threshold: Threshold for VCR calculation
        ed_percentile: Percentile threshold for edge detection
        se_bins: Number of bins for entropy calculation
    
    Returns:
        Dictionary containing all calculated metrics
    """
    metrics: Dict[str, Any] = {
        'timestamp': None,
        'screenshot_path': current_image_path,
        'vcr': None,
        'mafd': None,
        'se': None,
        'ed': None
    }
    
    # Preprocess current frame
    current_frame = preprocess_image(current_image_path, target_size, blur_sigma)
    if current_frame is None:
        logger.warning(f"Failed to preprocess current image: {current_image_path}")
        return metrics
    
    # Calculate metrics that don't require previous frame
    metrics['se'] = calculate_se(current_frame, bins=se_bins)
    metrics['ed'] = calculate_ed(current_frame, percentile_threshold=ed_percentile)
    
    # Calculate metrics that require previous frame
    if previous_image_path:
        previous_frame = preprocess_image(previous_image_path, target_size, blur_sigma)
        if previous_frame is not None:
            metrics['vcr'] = calculate_vcr(current_frame, previous_frame, threshold=vcr_threshold)
            metrics['mafd'] = calculate_mafd(current_frame, previous_frame)
    
    return metrics


def extract_text_from_vlm_response(raw_resp: Dict[str, Any]) -> str:
    """
    Extract text content from VLM response.
    
    Args:
        raw_resp: VLM response dictionary
    
    Returns:
        Extracted text string
    """
    if not raw_resp:
        return ""
    
    text_parts = []
    
    # Extract text from items
    items = raw_resp.get("items", [])
    for item in items:
        # Try different possible text fields
        if isinstance(item, dict):
            text = item.get("text") or item.get("content") or item.get("description") or item.get("summary", "")
            if text:
                text_parts.append(str(text))
    
    return " ".join(text_parts)


def tokenize_text(text: str) -> List[str]:
    """
    Simple tokenization - split by whitespace and punctuation.
    
    Args:
        text: Input text string
    
    Returns:
        List of tokens
    """
    if not text:
        return []
    
    # Simple tokenization: split by whitespace and punctuation
    tokens = re.findall(r'\b\w+\b', text.lower())
    return tokens


def calculate_ot(text: str) -> int:
    """
    Calculate OCR Token Count (OT).
    
    Tracks linguistic content amount and helps distinguish text-centric work from media consumption.
    
    Args:
        text: Extracted text string
    
    Returns:
        Number of tokens
    """
    tokens = tokenize_text(text)
    return len(tokens)


def calculate_td(text: str, pixel_count: int) -> float:
    """
    Calculate Text Density (TD).
    
    Normalized measure of text load, more comparable across different resolutions and zoom levels.
    
    Args:
        text: Extracted text string
        pixel_count: Total number of pixels in the image
    
    Returns:
        Text density (tokens per pixel)
    """
    if pixel_count == 0:
        return 0.0
    
    token_count = calculate_ot(text)
    return token_count / pixel_count


def calculate_tcr(current_text: str, previous_text: str) -> Optional[float]:
    """
    Calculate Text Change Rate (TCR).
    
    Separates stable reading from changing content (writing, navigation, page loads).
    Uses token-based Jaccard distance as approximation of Levenshtein distance.
    
    Args:
        current_text: Current frame text
        previous_text: Previous frame text
    
    Returns:
        TCR value [0, 1+], or None if previous_text is empty
    """
    if not previous_text:
        return None
    
    # Simple Levenshtein-like distance using token sequences
    current_tokens = set(tokenize_text(current_text))
    previous_tokens = set(tokenize_text(previous_text))
    
    # Jaccard distance as approximation
    if not previous_tokens:
        return 1.0 if current_tokens else 0.0
    
    intersection = len(current_tokens & previous_tokens)
    union = len(current_tokens | previous_tokens)
    
    # Normalize by previous token count
    if len(previous_tokens) == 0:
        return 1.0
    
    # Jaccard distance normalized
    jaccard_similarity = intersection / union if union > 0 else 0.0
    tcr = 1.0 - jaccard_similarity
    
    return float(tcr)


def calculate_nwr(current_token_count: int, previous_token_count: Optional[int], delta_time: float = 2.0) -> Optional[float]:
    """
    Calculate Net Writing Rate (NWR).
    
    A simple proxy for producing text (drafting, coding, messaging).
    
    Args:
        current_token_count: Current frame token count
        previous_token_count: Previous frame token count, or None
        delta_time: Time between frames in seconds (default: 2.0)
    
    Returns:
        NWR value (tokens per second), or None if previous_token_count is None
    """
    if previous_token_count is None:
        return None
    
    # Only count positive increases
    token_increase = max(0, current_token_count - previous_token_count)
    
    # Rate per second
    nwr = token_increase / delta_time if delta_time > 0 else 0.0
    
    return float(nwr)


def extract_context_from_vlm_response(raw_resp: Dict[str, Any]) -> str:
    """
    Extract context label (domain/title) from VLM response.
    
    Args:
        raw_resp: VLM response dictionary
    
    Returns:
        Context label string
    """
    if not raw_resp:
        return "unknown"
    
    # Try to extract context from items
    items = raw_resp.get("items", [])
    if not items:
        return "unknown"
    
    # Get first item's context type or title
    first_item = items[0] if isinstance(items, list) else items
    if isinstance(first_item, dict):
        context_type = first_item.get("context_type") or first_item.get("type", "")
        title = first_item.get("title") or first_item.get("summary", "")
        return f"{context_type}:{title}"[:100]  # Limit length
    
    return "unknown"


def calculate_csc(current_context: str, previous_context: Optional[str]) -> int:
    """
    Calculate Context Switch Count indicator.
    
    Returns 1 if context changed, 0 otherwise.
    
    Args:
        current_context: Current context label
        previous_context: Previous context label, or None
    
    Returns:
        1 if switched, 0 otherwise
    """
    if previous_context is None:
        return 0
    
    return 1 if current_context != previous_context else 0


def calculate_semantic_coherence(current_embedding: Optional[np.ndarray], previous_embedding: Optional[np.ndarray]) -> Optional[float]:
    """
    Calculate Consecutive Semantic Coherence (SC).
    
    Measures topic continuity even when the page changes slightly.
    
    Args:
        current_embedding: Current text embedding vector
        previous_embedding: Previous text embedding vector
    
    Returns:
        Cosine similarity [0, 1], or None if embeddings unavailable
    """
    if current_embedding is None or previous_embedding is None:
        return None
    
    # Convert to numpy arrays if needed
    if not isinstance(current_embedding, np.ndarray):
        current_embedding = np.array(current_embedding)
    if not isinstance(previous_embedding, np.ndarray):
        previous_embedding = np.array(previous_embedding)
    
    # Normalize vectors
    current_norm = np.linalg.norm(current_embedding)
    previous_norm = np.linalg.norm(previous_embedding)
    
    if current_norm == 0 or previous_norm == 0:
        return 0.0
    
    # Cosine similarity
    cosine_sim = np.dot(current_embedding, previous_embedding) / (current_norm * previous_norm)
    
    return float(cosine_sim)


def calculate_all_metrics_extended(
    current_image_path: str,
    previous_image_path: Optional[str] = None,
    raw_resp: Optional[Dict[str, Any]] = None,
    previous_raw_resp: Optional[Dict[str, Any]] = None,
    current_embedding: Optional[np.ndarray] = None,
    previous_embedding: Optional[np.ndarray] = None,
    target_size: Optional[Tuple[int, int]] = (320, 180),
    blur_sigma: float = 0.5,
    vcr_threshold: float = 0.05,
    ed_percentile: float = 85.0,
    se_bins: int = 64,
    delta_time: float = 2.0
) -> Dict[str, Any]:
    """
    Calculate all available metrics for a screenshot (extended version with text and semantic metrics).
    
    Args:
        current_image_path: Path to current screenshot
        previous_image_path: Path to previous screenshot (for change-based metrics)
        raw_resp: Current VLM response (for text-based metrics)
        previous_raw_resp: Previous VLM response (for change-based text metrics)
        current_embedding: Current text embedding (for semantic metrics)
        previous_embedding: Previous text embedding (for semantic metrics)
        target_size: Target size for downsampling (width, height)
        blur_sigma: Gaussian blur sigma
        vcr_threshold: Threshold for VCR calculation
        ed_percentile: Percentile threshold for edge detection
        se_bins: Number of bins for entropy calculation
        delta_time: Time between frames in seconds
    
    Returns:
        Dictionary containing all calculated metrics
    """
    # Start with basic visual metrics
    metrics = calculate_all_metrics(
        current_image_path=current_image_path,
        previous_image_path=previous_image_path,
        target_size=target_size,
        blur_sigma=blur_sigma,
        vcr_threshold=vcr_threshold,
        ed_percentile=ed_percentile,
        se_bins=se_bins
    )
    
    # Get image dimensions for text density calculation
    try:
        with Image.open(current_image_path) as img:
            pixel_count = img.width * img.height
    except Exception:
        pixel_count = target_size[0] * target_size[1] if target_size else 57600
    
    # Text-based metrics
    if raw_resp:
        current_text = extract_text_from_vlm_response(raw_resp)
        current_token_count = calculate_ot(current_text)
        metrics['ot'] = current_token_count
        metrics['td'] = calculate_td(current_text, pixel_count)
        
        # Text change metrics
        if previous_raw_resp:
            previous_text = extract_text_from_vlm_response(previous_raw_resp)
            previous_token_count = calculate_ot(previous_text)
            metrics['tcr'] = calculate_tcr(current_text, previous_text)
            metrics['nwr'] = calculate_nwr(current_token_count, previous_token_count, delta_time)
        else:
            metrics['tcr'] = None
            metrics['nwr'] = None
        
        # Context metrics
        current_context = extract_context_from_vlm_response(raw_resp)
        metrics['context'] = current_context
        
        if previous_raw_resp:
            previous_context = extract_context_from_vlm_response(previous_raw_resp)
            metrics['csc'] = calculate_csc(current_context, previous_context)
        else:
            metrics['csc'] = 0
    else:
        metrics['ot'] = None
        metrics['td'] = None
        metrics['tcr'] = None
        metrics['nwr'] = None
        metrics['context'] = None
        metrics['csc'] = 0
    
    # Semantic metrics
    if current_embedding is not None and previous_embedding is not None:
        metrics['sc'] = calculate_semantic_coherence(current_embedding, previous_embedding)
    else:
        metrics['sc'] = None
    
    return metrics

