<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import Toolbar from 'primevue/toolbar'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Divider from 'primevue/divider'
import LinkPopover from './LinkPopover.vue'
import ColorPopover from './ColorPopover.vue'
import { useTheme } from '../../composables/useTheme'

interface Props {
  editor: Editor | undefined
}

const props = defineProps<Props>()
const { isDark, toggleTheme } = useTheme()

// Heading options
const headingOptions = [
  { label: 'P', value: 'P' },
  { label: 'H1', value: 1 },
  { label: 'H2', value: 2 },
  { label: 'H3', value: 3 },
  { label: 'H4', value: 4 },
]

// List options with icons
const listOptions = [
  { label: 'format_list_bulleted', value: 'bulletList' },
  { label: 'format_list_numbered', value: 'orderedList' },
  { label: 'checklist', value: 'taskList' },
]

// Current list value
const currentList = computed({
  get: () => {
    if (!props.editor) return null
    if (props.editor.isActive('bulletList')) return 'bulletList'
    if (props.editor.isActive('orderedList')) return 'orderedList'
    if (props.editor.isActive('taskList')) return 'taskList'
    return null
  },
  set: (value) => {
    if (!props.editor || !value) return
    if (value === 'bulletList') {
      props.editor.chain().focus().toggleBulletList().run()
    } else if (value === 'orderedList') {
      props.editor.chain().focus().toggleOrderedList().run()
    } else if (value === 'taskList') {
      props.editor.chain().focus().toggleTaskList().run()
    }
  }
})

// Current heading value
const currentHeading = computed({
  get: () => {
    if (!props.editor) return 'P'
    for (let i = 1; i <= 4; i++) {
      if (props.editor.isActive('heading', { level: i })) return i
    }
    return 'P'
  },
  set: (value) => {
    if (!props.editor) return
    if (value === 'P') {
      props.editor.chain().focus().setParagraph().run()
    } else {
      props.editor.chain().focus().toggleHeading({ level: value as 1 | 2 | 3 | 4 }).run()
    }
  }
})


// Format states
const isBold = computed(() => props.editor?.isActive('bold') ?? false)
const isItalic = computed(() => props.editor?.isActive('italic') ?? false)
const isUnderline = computed(() => props.editor?.isActive('underline') ?? false)
const isCode = computed(() => props.editor?.isActive('code') ?? false)
const isSubscript = computed(() => props.editor?.isActive('subscript') ?? false)
const isSuperscript = computed(() => props.editor?.isActive('superscript') ?? false)
const isBlockquote = computed(() => props.editor?.isActive('blockquote') ?? false)
const isCodeBlock = computed(() => props.editor?.isActive('codeBlock') ?? false)

// Alignment states
const isAlignLeft = computed(() => props.editor?.isActive({ textAlign: 'left' }) ?? true)
const isAlignCenter = computed(() => props.editor?.isActive({ textAlign: 'center' }) ?? false)
const isAlignRight = computed(() => props.editor?.isActive({ textAlign: 'right' }) ?? false)
const isAlignJustify = computed(() => props.editor?.isActive({ textAlign: 'justify' }) ?? false)

// Commands
const toggleBold = () => props.editor?.chain().focus().toggleBold().run()
const toggleItalic = () => props.editor?.chain().focus().toggleItalic().run()
const toggleUnderline = () => props.editor?.chain().focus().toggleUnderline().run()
const toggleCode = () => props.editor?.chain().focus().toggleCode().run()
const toggleSubscript = () => props.editor?.chain().focus().toggleSubscript().run()
const toggleSuperscript = () => props.editor?.chain().focus().toggleSuperscript().run()
const toggleBlockquote = () => props.editor?.chain().focus().toggleBlockquote().run()
const toggleCodeBlock = () => props.editor?.chain().focus().toggleCodeBlock().run()

const setAlignLeft = () => props.editor?.chain().focus().setTextAlign('left').run()
const setAlignCenter = () => props.editor?.chain().focus().setTextAlign('center').run()
const setAlignRight = () => props.editor?.chain().focus().setTextAlign('right').run()
const setAlignJustify = () => props.editor?.chain().focus().setTextAlign('justify').run()

const undo = () => props.editor?.chain().focus().undo().run()
const redo = () => props.editor?.chain().focus().redo().run()

const canUndo = computed(() => props.editor?.can().undo() ?? false)
const canRedo = computed(() => props.editor?.can().redo() ?? false)

// Link popover
const linkPopoverRef = ref()
const showLinkPopover = (event: Event) => {
  linkPopoverRef.value?.toggle(event)
}

// Color popover
const colorPopoverRef = ref()
const showColorPopover = (event: Event) => {
  colorPopoverRef.value?.toggle(event)
}

// Image upload
const fileInput = ref<HTMLInputElement>()
const triggerImageUpload = () => {
  fileInput.value?.click()
}

const handleImageUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file && props.editor) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      props.editor?.chain().focus().setImage({ src: url }).run()
    }
    reader.readAsDataURL(file)
  }
  // Reset input
  if (target) target.value = ''
}
</script>

<template>
  <Toolbar class="editor-toolbar">
    <template #start>
      <!-- History -->
      <Button
        severity="secondary"
        text
        rounded
        :disabled="!canUndo"
        @click="undo"
        v-tooltip.bottom="'Undo'"
      >
        <template #icon>
          <span class="material-symbols-outlined">undo</span>
        </template>
      </Button>
      <Button
        severity="secondary"
        text
        :disabled="!canRedo"
        @click="redo"
        v-tooltip.bottom="'Redo'"
      >
        <template #icon>
          <span class="material-symbols-outlined">redo</span>
        </template>
      </Button>

      <Divider layout="vertical" />

      <!-- Text Formatting -->
      <Button
        severity="secondary"
        text
        :class="{ 'is-active': isBold }"
        @click="toggleBold"
        v-tooltip.bottom="'Bold'"
      >
        <template #icon>
          <span class="material-symbols-outlined">format_bold</span>
        </template>
      </Button>
      <Button
        severity="secondary"
        text
        :class="{ 'is-active': isItalic }"
        @click="toggleItalic"
        v-tooltip.bottom="'Italic'"
      >
        <template #icon>
          <span class="material-symbols-outlined">format_italic</span>
        </template>
      </Button>
      <Button
        severity="secondary"
        text
        :class="{ 'is-active': isUnderline }"
        @click="toggleUnderline"
        v-tooltip.bottom="'Underline'"
      >
        <template #icon>
          <span class="material-symbols-outlined">format_underlined</span>
        </template>
      </Button>
      

      <Divider layout="vertical" />

      <!-- Headings -->
      <Select
        v-model="currentHeading"
        :options="headingOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="P"
        size="small"
        class="heading-select"
        v-tooltip.bottom="'Heading Level'"
      />

      <Divider layout="vertical" />

      <!-- Lists -->
      <Select
        v-model="currentList"
        :options="listOptions"
        optionValue="value"
        placeholder=""
        class="list-select"
        size="small"
        v-tooltip.bottom="'List Type'"
      >
        <template #value="slotProps">
          <span v-if="slotProps.value" class="material-symbols-outlined select-icon">
            {{ listOptions.find(o => o.value === slotProps.value)?.label }}
          </span>
          <span v-else class="material-symbols-outlined select-icon">format_list_bulleted</span>
        </template>
        <template #option="slotProps">
          <span class="material-symbols-outlined select-icon">{{ slotProps.option.label }}</span>
        </template>
      </Select>

      <Divider layout="vertical" />

      <!-- Text Alignment -->
      <Button
        severity="secondary"
        text
        :class="{ 'is-active': isAlignLeft }"
        @click="setAlignLeft"
        v-tooltip.bottom="'Align Left'"
      >
        <template #icon>
          <span class="material-symbols-outlined">format_align_left</span>
        </template>
      </Button>
      <Button
        severity="secondary"
        text
        :class="{ 'is-active': isAlignCenter }"
        @click="setAlignCenter"
        v-tooltip.bottom="'Align Center'"
      >
        <template #icon>
          <span class="material-symbols-outlined">format_align_center</span>
        </template>
      </Button>
      <Button
        severity="secondary"
        text
        :class="{ 'is-active': isAlignRight }"
        @click="setAlignRight"
        v-tooltip.bottom="'Align Right'"
      >
        <template #icon>
          <span class="material-symbols-outlined">format_align_right</span>
        </template>
      </Button>
      <Button
        severity="secondary"
        text
        :class="{ 'is-active': isAlignJustify }"
        @click="setAlignJustify"
        v-tooltip.bottom="'Justify'"
      >
        <template #icon>
          <span class="material-symbols-outlined">format_align_justify</span>
        </template>
      </Button>

      <Divider layout="vertical" />

      <!-- Block Formatting -->
      <Button
        severity="secondary"
        text
        :class="{ 'is-active': isCode }"
        @click="toggleCode"
        v-tooltip.bottom="'Inline Code'"
      >
        <template #icon>
          <span class="material-symbols-outlined">code</span>
        </template>
      </Button>
      <Button
        severity="secondary"
        text
        :class="{ 'is-active': isSubscript }"
        @click="toggleSubscript"
        v-tooltip.bottom="'Subscript'"
      >
        <template #icon>
          <span class="material-symbols-outlined">subscript</span>
        </template>
      </Button>
      <Button
        severity="secondary"
        text
        :class="{ 'is-active': isSuperscript }"
        @click="toggleSuperscript"
        v-tooltip.bottom="'Superscript'"
      >
        <template #icon>
          <span class="material-symbols-outlined">superscript</span>
        </template>
      </Button>
      <Button
        severity="secondary"
        text
        :class="{ 'is-active': isBlockquote }"
        @click="toggleBlockquote"
        v-tooltip.bottom="'Blockquote'"
      >
        <template #icon>
          <span class="material-symbols-outlined">format_quote</span>
        </template>
      </Button>
      <Button
        severity="secondary"
        text
        :class="{ 'is-active': isCodeBlock }"
        @click="toggleCodeBlock"
        v-tooltip.bottom="'Code Block'"
      >
        <template #icon>
          <span class="material-symbols-outlined">terminal</span>
        </template>
      </Button>

      <Divider layout="vertical" />

      <!-- Insert -->
      <Button
        severity="secondary"
        text
        @click="showLinkPopover"
        v-tooltip.bottom="'Insert Link'"
      >
        <template #icon>
          <span class="material-symbols-outlined">link</span>
        </template>
      </Button>
      <Button
        severity="secondary"
        text
        @click="triggerImageUpload"
        v-tooltip.bottom="'Insert Image'"
      >
        <template #icon>
          <span class="material-symbols-outlined">image</span>
        </template>
      </Button>
      <Button
        severity="secondary"
        text
        @click="showColorPopover"
        v-tooltip.bottom="'Highlight Color'"
      >
        <template #icon>
          <span class="material-symbols-outlined">ink_highlighter</span>
        </template>
      </Button>

      <!-- Hidden file input for image upload -->
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        style="display: none"
        @change="handleImageUpload"
      />
    </template>

    <template #end>
      <!-- Theme Toggle -->
      <Button
        severity="secondary"
        text
        @click="toggleTheme"
        v-tooltip.bottom="isDark ? 'Light Mode' : 'Dark Mode'"
      >
        <template #icon>
          <span class="material-symbols-outlined">{{ isDark ? 'light_mode' : 'dark_mode' }}</span>
        </template>
      </Button>
    </template>
  </Toolbar>

  <!-- Popovers -->
  <LinkPopover ref="linkPopoverRef" :editor="editor" />
  <ColorPopover ref="colorPopoverRef" :editor="editor" />
</template>

<style scoped>
.editor-toolbar {
  border: none;
  border-bottom: 1px solid var(--tt-border-color);
  border-radius: 0;
  padding: 0.5rem;
  background: var(--tt-bg-color);
  gap: 0.25rem;
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
}

/* Hide scrollbar but keep functionality */
.editor-toolbar::-webkit-scrollbar {
  height: 2px;
}

.editor-toolbar::-webkit-scrollbar-track {
  background: transparent;
}

.editor-toolbar::-webkit-scrollbar-thumb {
  background: var(--tt-gray-light-a-200);
  border-radius: 2px;
}

.dark .editor-toolbar::-webkit-scrollbar-thumb {
  background: var(--tt-gray-dark-a-200);
}

.editor-toolbar :deep(.p-toolbar-start) {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: nowrap;
  flex-shrink: 0;
}

.editor-toolbar :deep(.p-toolbar-end) {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.editor-toolbar :deep(.p-button) {
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
}

.editor-toolbar :deep(.p-divider.p-divider-vertical) {
  margin: 0 0.25rem;
  height: 1.5rem;
}

/* Material Symbols icon styling */
.editor-toolbar :deep(.material-symbols-outlined) {
  font-size: 18px;
  font-weight: 400;
  line-height: 1;
}

/* Active button state - subtle background instead of green */
.editor-toolbar :deep(.p-button.is-active) {
  background-color: var(--tt-gray-light-a-200);
}

.dark .editor-toolbar :deep(.p-button.is-active) {
  background-color: var(--tt-gray-dark-a-200);
}



/* Compact select dropdowns */
.heading-select,
.list-select {
  width: 60px;
  height: 25px;
  align-items: center;
}

.heading-select :deep(.p-select),
.list-select :deep(.p-select) {
  border-radius: 4px;
}

.heading-select :deep(.p-select-label),
.list-select :deep(.p-select-label) {
  padding: 0px 10px;
  font-size: 0.9rem;
  line-height: 0.9rem;
}

.heading-select :deep(.p-select-dropdown),
.list-select :deep(.p-select-dropdown) {
  width: 1rem;
  padding: 0;
}

.heading-select :deep(.p-select-dropdown .p-icon),
.list-select :deep(.p-select-dropdown .p-icon) {
  width: 0.7rem;
}

/* Icon styling in list select */
.select-icon {
  font-size: 1.2rem;
  font-weight: 400;
  line-height: 1;
}
</style>

