import styles from './editorToolbar.module.css';
import { Button } from '../button/Button';

export default function EditorToolbar() {
    return (
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
    )
}


