"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";

export function useYjsCollab(fileName: string, signalingServer?: string) {
    const [content, setContent] = useState<string>("");
    const ydocRef = useRef<Y.Doc>();
    const ytextRef = useRef<Y.Text>();

    useEffect(() => {
        const ydoc = new Y.Doc();
        const provider = new WebrtcProvider(fileName, ydoc, {
            signaling: signalingServer ? [signalingServer] : undefined,
        });
        const ytext = ydoc.getText("markdown");
        ydocRef.current = ydoc;
        ytextRef.current = ytext;

        setContent(ytext.toString());

        const updateHandler = () => setContent(ytext.toString());
        ytext.observe(updateHandler);

        return () => {
            ytext.unobserve(updateHandler);
            provider.destroy();
            ydoc.destroy();
        };
    }, [fileName, signalingServer]);

    const setYjsContent = (val: string) => {
        if (ytextRef.current) {
            ytextRef.current.delete(0, ytextRef.current.length);
            ytextRef.current.insert(0, val);
        }
    };

    return [content, setYjsContent] as const;
}