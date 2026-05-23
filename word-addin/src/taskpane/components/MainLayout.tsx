import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import ChatPanel from "./ChatPanel";
import TrackChangesPanel from "./TrackChangesPanel";
import BottomTabs, { type TabId } from "./BottomTabs";
import ProjectsTab from "./ProjectsTab";
import TabularTab from "./TabularTab";
import WorkflowsTab from "./WorkflowsTab";
import ErrorBoundary from "./ErrorBoundary";

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const { signOut } = useAuth();

  // Cross-tab switch event from WorkflowsTab → "Use in chat" handoff.
  // Other components (e.g. agents B/C) dispatch a window CustomEvent
  // `mike.tab.switch` with detail set to the target TabId.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TabId>).detail;
      if (
        detail === "chat" ||
        detail === "projects" ||
        detail === "tabular" ||
        detail === "workflows" ||
        detail === "track"
      ) {
        setActiveTab(detail);
      }
    };
    window.addEventListener("mike.tab.switch", handler);
    return () => window.removeEventListener("mike.tab.switch", handler);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900">
      {/* Floating sign-out — no top header per design.
          Anchored top-right so it doesn't steal vertical space. */}
      <button
        onClick={signOut}
        title="Sign out"
        className="absolute top-1.5 right-2 z-10 text-[10px] text-gray-300 hover:text-gray-600 transition-colors px-1.5 py-0.5 rounded"
      >
        Sign out
      </button>

      {/*
        Active-tab swap. We mount ALL tabs once and toggle visibility via
        CSS instead of conditionally rendering, so each tab's local state
        (chat history, in-flight stream, scroll position, drilled-in
        project, etc.) survives a side-trip to another tab. Conditional
        render unmounts the chat panel and the user lost their messages
        (or saw a blank screen when reopening) every time they switched.
        Using `hidden` (display:none) keeps the React tree alive while
        ensuring offscreen panels don't interfere with layout.
      */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <div hidden={activeTab !== "chat"} className="h-full">
          <ErrorBoundary label="Chat ran into an error">
            <ChatPanel />
          </ErrorBoundary>
        </div>
        <div hidden={activeTab !== "projects"} className="h-full">
          <ErrorBoundary label="Projects tab ran into an error">
            <ProjectsTab />
          </ErrorBoundary>
        </div>
        <div hidden={activeTab !== "tabular"} className="h-full">
          <ErrorBoundary label="Tabular tab ran into an error">
            <TabularTab />
          </ErrorBoundary>
        </div>
        <div hidden={activeTab !== "workflows"} className="h-full">
          <ErrorBoundary label="Workflows tab ran into an error">
            <WorkflowsTab />
          </ErrorBoundary>
        </div>
        <div hidden={activeTab !== "track"} className="h-full">
          <ErrorBoundary label="Track tab ran into an error">
            <TrackChangesPanel />
          </ErrorBoundary>
        </div>
      </main>

      <BottomTabs active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
