<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import Popover from 'primevue/popover'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

interface Props {
  editor: Editor | undefined
}

const props = defineProps<Props>()

const popover = ref()
const linkUrl = ref('')

// Check if currently in a link
const isInLink = computed(() => props.editor?.isActive('link') ?? false)

// Get current link URL when popover opens
const onShow = () => {
  if (props.editor && isInLink.value) {
    const attrs = props.editor.getAttributes('link')
    linkUrl.value = attrs.href || ''
  } else {
    linkUrl.value = ''
  }
}

const toggle = (event: Event) => {
  popover.value?.toggle(event)
}

const applyLink = () => {
  if (!props.editor) return
  
  if (linkUrl.value) {
    // Ensure URL has protocol
    let url = linkUrl.value
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url
    }
    
    props.editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run()
  }
  
  popover.value?.hide()
}

const removeLink = () => {
  if (!props.editor) return
  
  props.editor.chain().focus().unsetLink().run()
  linkUrl.value = ''
  popover.value?.hide()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    applyLink()
  }
}

defineExpose({ toggle })
</script>

<template>
  <Popover ref="popover" @show="onShow">
    <div class="link-popover">
      <div class="link-input-group">
        <InputText
          v-model="linkUrl"
          placeholder="Enter URL..."
          class="link-input"
          @keydown="handleKeydown"
        />
      </div>
      <div class="link-actions">
        <Button
          label="Apply"
          icon="pi pi-check"
          size="small"
          @click="applyLink"
          :disabled="!linkUrl"
        />
        <Button
          v-if="isInLink"
          label="Remove"
          icon="pi pi-times"
          size="small"
          severity="danger"
          outlined
          @click="removeLink"
        />
      </div>
    </div>
  </Popover>
</template>

<style scoped>
.link-popover {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem;
  min-width: 280px;
}

.link-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.link-input {
  width: 100%;
}

.link-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>

