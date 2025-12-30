# Screenshot Analysis Logic

This document explains the complete logic flow for analyzing screenshots in MineContext.

## Overview

The screenshot analysis system processes screenshots through multiple stages: capture → deduplication → VLM analysis → context extraction → merging → storage. The system uses a Vision Language Model (VLM) to understand screenshot content and extract structured context information.

## Architecture Flow

```
Screenshot Capture → Deduplication → Batch Processing → VLM Analysis → Context Merging → Storage
```

## 1. Screenshot Capture (`opencontext/context_capture/screenshot.py`)

### Key Components:
- **Library**: Uses `mss` library for cross-platform screenshot capture
- **Format**: PNG (default) or JPEG
- **Multi-monitor**: Supports capturing from multiple monitors
- **Storage**: Optionally saves screenshots to disk

### Process:
1. Captures screenshots at configured intervals
2. Converts to PIL Image format
3. Saves to disk (if enabled)
4. Creates `RawContextProperties` objects with metadata

## 2. Deduplication (`opencontext/context_processing/processor/screenshot_processor.py`)

### Perceptual Hashing:
- Uses **difference hash (dhash)** algorithm via `imagehash` library
- Hash size: 8x8 (64-bit hash)
- Location: `opencontext/utils/image.py::calculate_phash()`

### Deduplication Logic:
```python
def _is_duplicate(self, new_context: RawContextProperties) -> bool:
    # 1. Calculate perceptual hash of new screenshot
    new_phash = calculate_phash(new_context.content_path)
    
    # 2. Compare with recent screenshots in cache
    for item in self._current_screenshot:
        # Calculate Hamming distance (bit differences)
        diff = bin(int(new_phash, 16) ^ int(item["phash"], 16)).count("1")
        
        # If difference <= threshold, it's a duplicate
        if diff <= self._similarity_hash_threshold:  # Default: 2
            return True  # Duplicate found
    
    # 3. New screenshot - add to cache
    self._current_screenshot.append({"phash": new_phash, "id": new_context.object_id})
    return False
```

### Configuration:
- `similarity_hash_threshold`: Maximum Hamming distance for duplicates (default: 2)
- `_current_screenshot`: LRU cache of recent screenshots (max: `batch_size * 2`)

### Image Optimization:
- Optional image resizing before processing
- `max_image_size`: Maximum dimension (default: 0 = no resize)
- `resize_quality`: JPEG quality (default: 95)

## 3. Batch Processing (`ScreenshotProcessor.batch_process()`)

### Queue-Based Processing:
- Screenshots are queued in `_input_queue` (max size: `batch_size * 3`)
- Background thread processes batches asynchronously
- Batch triggers:
  - When queue reaches `batch_size` (default: 10)
  - After `batch_timeout` seconds (default: 20s)

### Processing Loop:
```python
def _run_processing_loop(self):
    unprocessed_contexts = []
    while not self._stop_event.is_set():
        # Collect screenshots from queue
        raw_context = self._input_queue.get(timeout=self._batch_timeout)
        unprocessed_contexts.append(raw_context)
        
        # Trigger batch processing when:
        # - Batch size reached OR
        # - Timeout exceeded
        if len(unprocessed_contexts) >= self._batch_size or timeout:
            processed_contexts = await self.batch_process(unprocessed_contexts)
            get_storage().batch_upsert_processed_context(processed_contexts)
            unprocessed_contexts.clear()
```

## 4. VLM Analysis (`_process_vlm_single()`)

### Vision Language Model Integration:
- Uses `GlobalVLMClient` to call VLM API
- Location: `opencontext/llm/global_vlm_client.py`
- Supports tool calling for enhanced context

### Analysis Process:

#### Step 1: Image Encoding
```python
# Convert image to base64
base64_image = self._encode_image_to_base64(image_path)

# Create VLM message with image
content = [
    {"type": "text", "text": user_prompt},
    {
        "type": "image_url",
        "image_url": {"url": f"data:image/png;base64,{base64_image}"}
    }
]
```

#### Step 2: Prompt Construction
- **System Prompt**: From `config/prompts_en.yaml::processing.extraction.screenshot_analyze.system`
- **User Prompt**: Includes current timestamp, timezone, and context type descriptions
- **Key Instructions**:
  - Deep understanding of screenshot content
  - Natural language description ("who is doing what")
  - Subject identification (unified as "current_user")
  - Behavior inference from interface state
  - Multi-type context extraction

#### Step 3: VLM Response
```python
messages = [
    {"role": "system", "content": system_prompt},
    {"role": "user", "content": content}
]

raw_llm_response = await generate_with_messages_async(messages)
response_data = parse_json_from_response(raw_llm_response)
```

#### Step 4: Context Extraction
The VLM returns JSON with multiple context items:
```json
{
  "items": [
    {
      "context_type": "activity_context | semantic_context | state_context | procedural_context | intent_context",
      "title": "string",
      "summary": "detailed description",
      "keywords": ["keyword1", "keyword2"],
      "importance": 0-10,
      "confidence": 0-10,
      "event_time": "ISO 8601 format or null"
    }
  ]
}
```

### Context Types:

1. **activity_context** (Default):
   - User's current activities and behaviors
   - Style: "current_user viewing...", "current_user configuring..."
   - Example: "current_user viewing project management board"

2. **semantic_context**:
   - Knowledge content (documents, technical specs, architecture)
   - Style: "Technical architecture adopts...", "Core principle is..."
   - Example: "MineContext Technical Architecture"

3. **state_context**:
   - Current status, progress, metrics
   - Style: "Project progress shows...", "System status is..."
   - Example: "Project Progress: Frontend development 80% complete"

4. **procedural_context**:
   - Reusable operation processes
   - Style: "Step 1:...; Step 2:...; Step 3:..."
   - Example: "Steps for merging code using Git"

5. **intent_context**:
   - Future plans and goals
   - Style: Future tense, plans/goals
   - Example: "Next week product release preparation items"

### Concurrent Processing:
```python
# Process all screenshots in parallel
vlm_results = await asyncio.gather(
    *[self._process_vlm_single(raw_context) for raw_context in raw_contexts],
    return_exceptions=True
)
```

## 5. Context Merging (`_merge_contexts()`)

### Merge Strategy:
- Groups extracted contexts by `context_type`
- Merges similar contexts using LLM
- Preserves all details (no summarization)

### Merge Process:

#### Step 1: Group by Type
```python
items_by_type = {}
for item in processed_items:
    context_type = item.extracted_data.context_type
    items_by_type.setdefault(context_type, []).append(item)
```

#### Step 2: LLM-Based Merging
- Uses prompt: `merging.screenshot_batch_merging`
- Determines which items should be merged based on semantic similarity
- Merge criteria vary by context type:
  - **activity_context**: Must be same explicit task (strict)
  - **semantic_context**: Same topic/knowledge area
  - **state_context**: Same object's status updates
  - **procedural_context**: Same process steps
  - **intent_context**: Same goal/project plans

#### Step 3: Merge Decision
```json
{
  "items": [
    {
      "merge_type": "merged" | "new",
      "merged_ids": ["id1", "id2", ...],
      "data": {
        "title": "merged title",
        "summary": "complete merged summary (preserves all details)",
        "keywords": [...],
        "entities": [...],
        "importance": 0-10,
        "confidence": 0-10,
        "event_time": "ISO 8601 or null"
      }
    }
  ]
}
```

#### Step 4: Entity Extraction
- Parallel entity refresh for all merged/new contexts
- Validates and cleans entities
- Extracts: people, projects, products, documents, organizations, locations

### Merge Rules:
- **Merged**: Multiple items → one combined context
  - Combines all raw properties
  - Merges create_time (earliest), event_time (latest)
  - Sums duration_count and merge_count
- **New**: Independent item
  - Keeps original data
  - No merging needed

## 6. Vectorization & Storage

### Vectorization:
- Creates embeddings from `title + summary`
- Uses global embedding client
- Format: `ContentFormat.TEXT`

### Storage:
- Stores `ProcessedContext` objects in unified storage
- Batch upsert for efficiency
- Deletes old contexts when merged

## Configuration

### Key Parameters (`config/config.yaml`):

```yaml
processing:
  screenshot_processor:
    similarity_hash_threshold: 2      # Hamming distance for duplicates
    batch_size: 10                    # Screenshots per batch
    batch_timeout: 20                 # Seconds before timeout
    max_image_size: 0                 # Max dimension (0 = no resize)
    resize_quality: 95                # JPEG quality
    enabled_delete: false             # Delete duplicate files
```

### VLM Configuration:
```yaml
vlm_model:
  base_url: "https://..."
  api_key: "..."
  model: "..."
```

## Error Handling

- **Deduplication failures**: Logs error, continues processing
- **VLM failures**: Records error, increments failure stats
- **Merge failures**: Logs error, continues with other contexts
- **Entity extraction failures**: Logs error, continues without entities

## Monitoring

- Records processing metrics (duration, context count)
- Tracks statistics (processed, failed counts)
- Records screenshot paths for UI display
- Increments data counts by context type

## Example Flow

1. **Screenshot captured** → Saved to disk
2. **Deduplication check** → Perceptual hash calculated, compared with cache
3. **If new** → Added to processing queue
4. **Batch collected** → 10 screenshots or 20s timeout
5. **VLM analysis** → All screenshots analyzed concurrently
6. **Context extraction** → Multiple context types extracted per screenshot
7. **Merging** → Similar contexts merged by type
8. **Entity extraction** → Entities refreshed in parallel
9. **Storage** → Processed contexts saved to database

## Key Files

- `opencontext/context_capture/screenshot.py` - Screenshot capture
- `opencontext/context_processing/processor/screenshot_processor.py` - Main processor
- `opencontext/llm/global_vlm_client.py` - VLM client
- `opencontext/utils/image.py` - Image utilities (hashing, resizing)
- `config/prompts_en.yaml` - Analysis prompts
- `config/prompts_zh.yaml` - Chinese prompts

## Performance Optimizations

1. **Concurrent VLM calls**: All screenshots analyzed in parallel
2. **Batch processing**: Reduces database writes
3. **Perceptual hashing**: Fast duplicate detection
4. **Image resizing**: Reduces VLM processing time
5. **Queue-based**: Non-blocking screenshot capture
6. **LRU cache**: Efficient duplicate detection

