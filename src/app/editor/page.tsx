import styles from "./editor.module.css";
import Logo from "@/components/logo/logo";
import AI_Toolbar from "@/components/AI_Toolbar/AI_Toolbar";
import { Button } from "@/components/button/Button";

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
            <div className={styles.editorToolbar}>
              <Button variant="secondary" size="small" icon="format_bold"></Button>
              <Button variant="secondary" size="small" icon="format_italic"></Button>
              <Button variant="secondary" size="small" icon="format_underlined"></Button>
              <Button variant="secondary" size="small" icon="format_strikethrough"></Button>
              <Button variant="secondary" size="small" icon="superscript"></Button>
              <Button variant="secondary" size="small" icon="subscript"></Button>
              <Button variant="secondary" size="small" icon="code"></Button>
              <Button variant="secondary" size="small" icon="function"></Button>
              <Button variant="secondary" size="small" icon="format_ink_highlighter"></Button>
              <Button variant="secondary" size="small" icon="comment"></Button>
              <Button variant="secondary" size="small" icon="link"></Button>
              <Button variant="secondary" size="small" icon="photo"></Button>
              <Button variant="secondary" size="small" icon="table"></Button>
              <Button variant="secondary" size="small" icon="format_quote"></Button>

              <div className={styles.editorToolbarButton}>
                <Button variant="secondary" size="small" icon="toolbar"></Button>
              </div>
            </div>
          </div>

          {/* Editor Content */}
          <div className={styles.editorContent}>

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



