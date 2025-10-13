
import styles from './styles.module.scss'
import Logo from "@/components/logo/logo";
import AI_Toolbar from "@/components/AI_Toolbar/AI_Toolbar";
import { Button } from "@/components/button/Button";
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'

const { page, pageContainer, sidebar, sidebarHeader, menuItems, sidebarContent, sidebarFooter, mainEditor, editorHeader, editorTabBar, editorContent } = styles;

export default function Editor() {
  return (
    <div className={page}>
      <div className={pageContainer}>

        {/* Left Sidebar */}
        <div className={sidebar}>

          {/* Sidebar Header */}
          <div className={sidebarHeader}>
            <Logo />
            <Button variant="primary" size="medium" icon="dock_to_right"></Button>
          </div>

          {/* Sidebar Menu Items */}
          <div className={menuItems}>
            <Button variant="primary" size="small" text="File"></Button>
            <Button variant="primary" size="small" text="Edit"></Button>
            <Button variant="primary" size="small" text="View"></Button>
            <Button variant="primary" size="small" text="Insert"></Button>
            <Button variant="primary" size="small" text="Format"></Button>
            <Button variant="primary" size="small" text="Tools"></Button>
            <Button variant="primary" size="small" text="Help"></Button>
          </div>

          {/* Sidebar Content */}
          <div className={sidebarContent}>

          </div>

          {/* Sidebar Footer */}
          <div className={sidebarFooter}>
            <Button variant="primary" size="medium" icon="settings"></Button>
            <Button variant="primary" size="medium" icon="person_add"></Button>
          </div>
        </div>

        {/* Main Editor */}
        <div className={mainEditor}>

          {/* Editor Header */}
          <div className={editorHeader}>

            {/* Editor Tab Bar */}
            <div className={editorTabBar}>

            </div>
          </div>

          {/* Editor Content */}
          <div className={editorContent}>
            <SimpleEditor />
            {/* <Tiptap/> */}
          </div>

          {/* Editor Footer */}
          <AI_Toolbar />
        </div>

        {/* Right Sidebar */}
        <div className={sidebar}>

          {/* Sidebar Header */}
          <div className={sidebarHeader}>
          <Button variant="primary" size="medium" icon="dock_to_left"></Button>
          </div>

          {/* Sidebar Content */}
          <div className={sidebarContent}>

          </div>

          {/* Sidebar Footer */}
          <div className={sidebarFooter}>
            <Button variant="primary" size="medium" icon="history"></Button>
          </div>
        </div>
      </div>
    </div>
  );
}



