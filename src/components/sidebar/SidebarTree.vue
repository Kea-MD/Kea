<script setup lang="ts">
import { ref, computed } from 'vue'

// Tree navigation data structure
interface TreeItem {
  id: string
  label: string
  href?: string
  current?: boolean
  items?: TreeItem[]
}

interface TreeGroup {
  title: string
  items: TreeItem[]
}

interface TreeData {
  label: string
  groups: TreeGroup[]
}

const props = defineProps<{
  data?: TreeData
  searchTerm?: string
}>()

const emit = defineEmits<{
  (e: 'item-click', item: TreeItem): void
}>()

// Default tree data
const defaultTreeData: TreeData = {
  label: "Navigation",
  groups: [
    {
      title: "Base",
      items: [
        { id: "intro", label: "Introduction", href: "#introduction", current: true },
        { id: "getting-started", label: "Getting Started", href: "#getting-started" },
        { id: "checklist", label: "The Checklist", href: "#checklist" },
        { id: "requests", label: "Requests", href: "#requests" }
      ]
    },
    {
      title: "Modules",
      items: [
        {
          id: "foundations",
          label: "Foundations",
          href: "#foundations",
          items: [
            { id: "overview", label: "Overview", href: "#overview" },
            {
              id: "css-animation",
              label: "CSS Animation",
              href: "#css-animation",
              items: [
                { id: "css-animation-anatomy", label: "Anatomy", href: "#css-animation-anatomy" },
                { id: "first-keyframe", label: "Keyframes", href: "#keyframes" },
                { id: "delays", label: "Delays", href: "#delays" }
              ]
            },
            {
              id: "svg-filters",
              label: "SVG Filters",
              href: "#svg-filters",
              items: [
                { id: "svg-filter-anatomy", label: "Anatomy", href: "#svg-filter-anatomy" },
                { id: "goo", label: "Goo", href: "#goo" },
                { id: "noise", label: "Noise", href: "#noise" }
              ]
            }
          ]
        },
        {
          id: "studio",
          label: "Studio",
          href: "#studio",
          items: [
            { id: "tri-toggle", label: "Tri-Toggle", href: "#tri-toggle" },
            {
              id: "liquid-glass",
              label: "Liquid Glass",
              href: "#liquid-glass",
              items: [
                { id: "liquid-displacement", label: "Displacement", href: "#liquid-displacement" },
                { id: "liquid-toggle", label: "Toggle", href: "#liquid-toggle" },
                { id: "liquid-slider", label: "Slider", href: "#liquid-slider" }
              ]
            },
            { id: "bear-toggle", label: "Bear toggle", href: "#bear-toggle" }
          ]
        }
      ]
    }
  ]
}

const treeData = computed(() => props.data || defaultTreeData)

const expandedNodes = ref(new Set<string>())
const treeRef = ref<HTMLElement | null>(null)

// Helper to check if an item is expanded
const isExpanded = (itemId: string) => expandedNodes.value.has(itemId)

// Toggle expanded state
const toggleExpanded = (itemId: string) => {
  if (expandedNodes.value.has(itemId)) {
    expandedNodes.value.delete(itemId)
  } else {
    expandedNodes.value.add(itemId)
  }
}

// Handle item click
const handleItemClick = (event: MouseEvent, item: TreeItem) => {
  const target = event.target as HTMLElement
  const icon = target.closest('.tree-icon')

  if (icon && item.items?.length) {
    event.preventDefault()
    toggleExpanded(item.id)
  } else {
    emit('item-click', item)
  }
}

// Handle keyboard navigation
const handleKeydown = (event: KeyboardEvent, item: TreeItem, _level: number) => {
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      emit('item-click', item)
      break
    case 'ArrowRight':
      event.preventDefault()
      if (item.items?.length && !isExpanded(item.id)) {
        toggleExpanded(item.id)
      }
      break
    case 'ArrowLeft':
      event.preventDefault()
      if (item.items?.length && isExpanded(item.id)) {
        toggleExpanded(item.id)
      }
      break
  }
}

// Filter functionality
const filteredData = computed(() => {
  if (!props.searchTerm || props.searchTerm.length < 3) {
    return { data: treeData.value, matches: new Set<string>(), related: new Set<string>() }
  }

  const term = props.searchTerm.toLowerCase()
  const matches = new Set<string>()
  const related = new Set<string>()

  const findMatches = (items: TreeItem[], ancestors: string[] = []) => {
    items.forEach(item => {
      if (item.label.toLowerCase().includes(term)) {
        matches.add(item.id)
        ancestors.forEach(id => related.add(id))
        if (item.items) {
          const markDescendants = (children: TreeItem[]) => {
            children.forEach(child => {
              related.add(child.id)
              if (child.items) markDescendants(child.items)
            })
          }
          markDescendants(item.items)
        }
      }
      if (item.items) {
        findMatches(item.items, [...ancestors, item.id])
      }
    })
  }

  treeData.value.groups.forEach(group => findMatches(group.items))

  // Auto-expand matching ancestors
  related.forEach(id => expandedNodes.value.add(id))
  matches.forEach(id => {
    const item = findItemById(id, treeData.value.groups.flatMap(g => g.items))
    if (item?.items?.length) expandedNodes.value.add(id)
  })

  return { data: treeData.value, matches, related }
})

const findItemById = (id: string, items: TreeItem[]): TreeItem | null => {
  for (const item of items) {
    if (item.id === id) return item
    if (item.items) {
      const found = findItemById(id, item.items)
      if (found) return found
    }
  }
  return null
}

const isFiltering = computed(() => props.searchTerm && props.searchTerm.length >= 3)
const matchCount = computed(() => filteredData.value.matches.size)

defineExpose({ matchCount })
</script>

<template>
  <div class="sidebar-tree" ref="treeRef" :data-filtering="isFiltering">
    <ul role="tree" :aria-label="treeData.label">
      <li
        v-for="(group, groupIndex) in treeData.groups"
        :key="groupIndex"
        role="none"
        class="tree-group-container"
      >
        <ul role="group" :id="`tree-group-toplevel-${groupIndex}`">
          <template v-for="item in group.items" :key="item.id">
            <li role="none">
              <a
                :id="`tree-item-${item.id}`"
                role="treeitem"
                :href="item.href || '#'"
                :tabindex="item.current ? 0 : -1"
                aria-level="1"
                :aria-setsize="group.items.length"
                :aria-posinset="group.items.indexOf(item) + 1"
                :aria-current="item.current ? 'page' : undefined"
                :aria-expanded="item.items?.length ? isExpanded(item.id) : undefined"
                :aria-owns="item.items?.length ? `tree-group-${item.id}` : undefined"
                :data-search-match="filteredData.matches.has(item.id) || undefined"
                :data-search-related="filteredData.related.has(item.id) || undefined"
                :data-filtered="isFiltering && !filteredData.matches.has(item.id) && !filteredData.related.has(item.id) || undefined"
                @click="handleItemClick($event, item)"
                @keydown="handleKeydown($event, item, 1)"
              >
                <span>{{ item.label }}</span>
                <span v-if="item.items?.length" class="tree-icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
              </a>

              <!-- Nested items level 2 -->
              <div v-if="item.items?.length" :class="{ 'inert': !isExpanded(item.id) }">
                <ul :id="`tree-group-${item.id}`" role="group">
                  <template v-for="child in item.items" :key="child.id">
                    <li role="none">
                      <a
                        :id="`tree-item-${child.id}`"
                        role="treeitem"
                        :href="child.href || '#'"
                        tabindex="-1"
                        aria-level="2"
                        :aria-setsize="item.items.length"
                        :aria-posinset="item.items.indexOf(child) + 1"
                        :aria-current="child.current ? 'page' : undefined"
                        :aria-expanded="child.items?.length ? isExpanded(child.id) : undefined"
                        :aria-owns="child.items?.length ? `tree-group-${child.id}` : undefined"
                        :data-search-match="filteredData.matches.has(child.id) || undefined"
                        :data-search-related="filteredData.related.has(child.id) || undefined"
                        :data-filtered="isFiltering && !filteredData.matches.has(child.id) && !filteredData.related.has(child.id) || undefined"
                        @click="handleItemClick($event, child)"
                        @keydown="handleKeydown($event, child, 2)"
                      >
                        <span>{{ child.label }}</span>
                        <span v-if="child.items?.length" class="tree-icon" aria-hidden="true">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        </span>
                      </a>

                      <!-- Nested items level 3 -->
                      <div v-if="child.items?.length" :class="{ 'inert': !isExpanded(child.id) }">
                        <ul :id="`tree-group-${child.id}`" role="group">
                          <li v-for="grandchild in child.items" :key="grandchild.id" role="none">
                            <a
                              :id="`tree-item-${grandchild.id}`"
                              role="treeitem"
                              :href="grandchild.href || '#'"
                              tabindex="-1"
                              aria-level="3"
                              :aria-setsize="child.items.length"
                              :aria-posinset="child.items.indexOf(grandchild) + 1"
                              :aria-current="grandchild.current ? 'page' : undefined"
                              :data-search-match="filteredData.matches.has(grandchild.id) || undefined"
                              :data-search-related="filteredData.related.has(grandchild.id) || undefined"
                              :data-filtered="isFiltering && !filteredData.matches.has(grandchild.id) && !filteredData.related.has(grandchild.id) || undefined"
                              @click="handleItemClick($event, grandchild)"
                              @keydown="handleKeydown($event, grandchild, 3)"
                            >
                              <span>{{ grandchild.label }}</span>
                            </a>
                          </li>
                        </ul>
                      </div>
                    </li>
                  </template>
                </ul>
              </div>
            </li>
          </template>
        </ul>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sidebar-tree {
  display: block;
  height: 100%;
  font-size: 0.875rem;
  color: var(--tt-gray-dark-600);
}

.sidebar-tree ul[role="tree"],
.sidebar-tree ul[role="group"] {
  list-style: none;
  margin: 0;
  padding: 0;
  display: block;
  position: relative;
}

.sidebar-tree ul[role="tree"] {
  display: grid;
  height: 100%;
  grid-template-rows: auto 1fr;
}

.tree-group-container {
  list-style: none;
}

.tree-group-container:first-of-type {
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  position: relative;
}

.tree-group-container:first-of-type::after {
  content: '';
  position: absolute;
  top: 100%;
  transform: translateY(-50%);
  left: 0.5rem;
  right: 0.5rem;
  height: 2px;
  opacity: 0.5;
  background: rgba(255, 255, 255, 0.1);
  transition: right var(--sidebar-speed, 0.16s) var(--sidebar-timing, ease-out);
}

.tree-group-container + .tree-group-container {
  height: 100%;
  overflow: auto;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

/* Nested groups indentation */
.sidebar-tree li > div ul[role="group"] {
  margin-left: 1rem;
}

.sidebar-tree li > div ul[role="group"] > li:first-of-type {
  margin-top: 0.5rem;
}

.sidebar-tree li > div ul[role="group"] > li:last-of-type {
  margin-bottom: 0.5rem;
}

.sidebar-tree li > div ul[role="group"]::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.5rem;
  bottom: 0.5rem;
  width: 2px;
  background: rgba(255, 255, 255, 0.15);
}

/* Grid wrapper for smooth expand/collapse */
.sidebar-tree li > div {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows var(--sidebar-duration, 0.18s) var(--sidebar-timing, ease-out);
  overflow: hidden;
}

.sidebar-tree li > div.inert {
  grid-template-rows: 0fr;
}

.sidebar-tree li > div.inert > ul[role="group"] {
  opacity: 0.4;
  transform: translateY(12px);
  filter: blur(10px);
}

.sidebar-tree li > div > ul[role="group"] {
  min-height: 0;
  transition: transform var(--sidebar-duration, 0.18s), opacity var(--sidebar-duration, 0.18s), filter var(--sidebar-duration, 0.18s);
  transform: translateY(0);
  filter: blur(0);
  opacity: 1;
}

.sidebar-tree li > div > ul {
  min-height: 0;
}

/* Tree item styling */
.sidebar-tree [role="treeitem"] {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  color: inherit;
  padding: 0.25rem 0.5rem 0.25rem 1rem;
  line-height: 1.6;
  width: 100%;
  gap: 0.5rem;
  position: relative;
  border-radius: 4px;
}

.sidebar-tree [role="treeitem"] span:first-of-type {
  flex: 1;
}

.sidebar-tree [role="treeitem"]:hover {
  color: rgba(255, 255, 255, 0.9);
}

.sidebar-tree [role="treeitem"]:focus {
  outline: none;
  color: rgba(255, 255, 255, 0.9);
  background-color: rgba(255, 255, 255, 0.08);
}

.sidebar-tree [role="treeitem"][aria-current="page"] {
  color: #fff;
}

.sidebar-tree [role="treeitem"][aria-current="page"]::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--tt-brand-color-500);
  transform: translateX(-50%);
  border-radius: 2px;
}

.sidebar-tree [role="treeitem"][aria-current="page"][aria-level="1"]::before {
  left: 2px;
}

/* Expanded icon rotation */
.sidebar-tree [role="treeitem"][aria-expanded="true"] .tree-icon svg {
  transform: rotate(135deg);
}

/* Tree icon */
.tree-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
  border-radius: 4px;
}

.tree-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.tree-icon svg {
  width: 16px;
  height: 16px;
  transition: transform 0.26s ease-out;
}

/* Search/filter styling */
.sidebar-tree[data-filtering="true"] [role="treeitem"] {
  opacity: 0.6;
}

.sidebar-tree[data-filtering="true"] [role="treeitem"][data-search-match="true"] {
  opacity: 1;
  color: #fff;
  background-color: rgba(98, 41, 255, 0.4);
}

.sidebar-tree[data-filtering="true"] [role="treeitem"][data-search-related="true"] {
  color: rgba(255, 255, 255, 0.9);
  background-color: rgba(98, 41, 255, 0.2);
}

.sidebar-tree[data-filtering="true"] [role="treeitem"]:focus {
  opacity: 1;
}
</style>
