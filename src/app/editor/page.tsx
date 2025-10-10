import styles from "./editor.module.css";
import Logo from "@/components/logo/logo";
import AI_Toolbar from "@/components/AI_Toolbar/AI_Toolbar";
import { Button } from "@/components/button/Button";
import EditorToolbar from "@/components/editorToolbar/editorToolbar";
import editor from "@/components/editor/editor";

export default function Editor() {
  return (
    <div className={styles.page}>
      <div className={styles.pageContainer}>

        {/* Left Sidebar */}
        <div className={styles.sidebar}>

          {/* Sidebar Header */}
          <div className={styles.sidebarHeader}>
            <Logo />
            <Button variant="primary" size="medium" icon="dock_to_right"></Button>
          </div>

          {/* Sidebar Menu Items */}
          <div className={styles.menuItems}>
            <Button variant="primary" size="small" text="File"></Button>
            <Button variant="primary" size="small" text="Edit"></Button>
            <Button variant="primary" size="small" text="View"></Button>
            <Button variant="primary" size="small" text="Insert"></Button>
            <Button variant="primary" size="small" text="Format"></Button>
            <Button variant="primary" size="small" text="Tools"></Button>
            <Button variant="primary" size="small" text="Help"></Button>
          </div>

          {/* Sidebar Content */}
          <div className={styles.sidebarContent}>

          </div>

          {/* Sidebar Footer */}
          <div className={styles.sidebarFooter}>
            <Button variant="primary" size="medium" icon="settings"></Button>
            <Button variant="primary" size="medium" icon="person_add"></Button>
          </div>
        </div>

        {/* Main Editor */}
        <div className={styles.mainEditor}>

          {/* Editor Header */}
          <div className={styles.editorHeader}>

            {/* Editor Tab Bar */}
            <div className={styles.editorTabBar}>

            </div>
            {/* Editor Header */}
            <EditorToolbar />
          </div>

          {/* Editor Content */}
          <div className={styles.editorContent}>
            <editorS/>
          </div>

          {/* Editor Footer */}
          <AI_Toolbar />
        </div>

        {/* Right Sidebar */}
        <div className={styles.sidebar}>

          {/* Sidebar Header */}
          <div className={styles.sidebarHeader}>
          <Button variant="primary" size="medium" icon="dock_to_left"></Button>
          </div>

          {/* Sidebar Content */}
          <div className={styles.sidebarContent}>

          </div>

          {/* Sidebar Footer */}
          <div className={styles.sidebarFooter}>
            <Button variant="primary" size="medium" icon="history"></Button>
          </div>
        </div>
      </div>
    </div>
  );
}



