import React, { useMemo, useState } from "react";
import type {
  ConnectionVM,
  SearchUserVM,
  MessageSummaryVM,
} from "../../types/viewModels";
import { Avatar } from "./Avatar";
import { InlineNotice } from "../InlineNotice";
import { formatRelative } from "../../lib/messageTime";
import { SearchIcon, ChevronIcon, ComposeIcon } from "./icons";

interface ChatSidebarProps {
  connections: ConnectionVM[];
  summaries: Record<string, MessageSummaryVM>;
  selectedConnectionId: string | null;
  onSelect: (connectionId: string) => void;

  currentUserId: string | null;
  favorites: Set<string>;
  onToggleFavorite: (connectionId: string) => void;

  // Pending connection requests (preserved actions)
  pending: ConnectionVM[];
  onAccept: (connectionId: string) => void;
  onReject: (connectionId: string) => void;
  onCancel: (connectionId: string) => void;

  // Directory search (find new people to connect with)
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  searchResults: SearchUserVM[];
  searchError: string | null;
  onDismissSearchError: () => void;
  onConnect: (userId: string) => void;

  typing: Record<string, boolean>;
}

/** Left conversation column: search, Favorites + Chats sections, chat list. */
export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  connections,
  summaries,
  selectedConnectionId,
  onSelect,
  currentUserId,
  favorites,
  onToggleFavorite,
  pending,
  onAccept,
  onReject,
  onCancel,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  searchResults,
  searchError,
  onDismissSearchError,
  onConnect,
  typing,
}) => {
  const [favOpen, setFavOpen] = useState(true);
  const [chatsOpen, setChatsOpen] = useState(true);
  const [reqOpen, setReqOpen] = useState(true);

  // Only accepted connections are chat threads.
  const accepted = useMemo(
    () => connections.filter((c) => c.status === "ACCEPTED"),
    [connections],
  );

  // Client-side filter of existing chats by the search term (name/email).
  const term = searchQuery.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return accepted;
    return accepted.filter(
      (c) =>
        c.contact.name.toLowerCase().includes(term) ||
        c.contact.email.toLowerCase().includes(term),
    );
  }, [accepted, term]);

  // Sort by most recent message first; connections without messages sink down.
  const sorted = useMemo(() => {
    const ts = (c: ConnectionVM) => {
      const s = summaries[c.id];
      return s ? new Date(s.lastMessage.createdAt).getTime() : 0;
    };
    return [...filtered].sort((a, b) => ts(b) - ts(a));
  }, [filtered, summaries]);

  const favList = sorted.filter((c) => favorites.has(c.id));
  const chatList = sorted.filter((c) => !favorites.has(c.id));

  const renderItem = (conn: ConnectionVM) => {
    const summary = summaries[conn.id];
    const isSelected = conn.id === selectedConnectionId;
    const isFav = favorites.has(conn.id);
    const isTyping = typing[conn.id];

    let preview = "No messages yet";
    if (isTyping) {
      preview = "typing…";
    } else if (summary) {
      const mine = summary.lastMessage.senderId === currentUserId;
      preview = `${mine ? "You: " : ""}${summary.lastMessage.body}`;
    }
    const unread = summary?.unreadCount ?? 0;

    return (
      <div
        key={conn.id}
        role="button"
        tabIndex={0}
        className={`msgx-item${isSelected ? " is-selected" : ""}`}
        onClick={() => onSelect(conn.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(conn.id);
          }
        }}
        aria-pressed={isSelected}
      >
        <Avatar name={conn.contact.name} />
        <div className="msgx-item__body">
          <div className="msgx-item__row">
            <span className="msgx-item__name">{conn.contact.name}</span>
            <span className="msgx-item__time">
              {summary ? formatRelative(summary.lastMessage.createdAt) : ""}
            </span>
          </div>
          <div className="msgx-item__row">
            <span
              className={`msgx-item__preview${unread > 0 && !isSelected ? " is-unread" : ""}`}
              style={
                isTyping
                  ? { color: "var(--accent-blue)", fontStyle: "italic" }
                  : undefined
              }
            >
              {preview}
            </span>
            {unread > 0 && !isSelected && (
              <span className="msgx-badge">{unread}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="msgx-iconbtn"
          style={{
            width: 26,
            height: 26,
            color: isFav ? "#f5b301" : "var(--text-secondary)",
          }}
          title={isFav ? "Remove from favorites" : "Add to favorites"}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(conn.id);
          }}
        >
          {isFav ? "★" : "☆"}
        </button>
      </div>
    );
  };

  return (
    <aside className="msgx-sidebar" aria-label="Conversations">
      <div className="msgx-sidebar__head">
        <h1 className="msgx-sidebar__title">Chat</h1>
        <div className="msgx-sidebar__head-actions">
          <span className="msgx-iconbtn" aria-hidden="true">
            <ComposeIcon />
          </span>
        </div>
      </div>

      <div className="msgx-search">
        <form
          className="msgx-search__field"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
        >
          <SearchIcon />
          <input
            className="msgx-search__input"
            type="text"
            placeholder="Search people by name or email"
            aria-label="Search people"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </form>
      </div>

      <div className="msgx-sidebar__scroll">
        {searchError && (
          <div style={{ padding: "0 8px 8px" }}>
            <InlineNotice
              message={searchError}
              variant="error"
              onDismiss={onDismissSearchError}
            />
          </div>
        )}

        {searchResults.length > 0 && (
          <>
            <div className="msgx-section" aria-hidden="true">
              Directory
            </div>
            {searchResults.map((u) => (
              <div key={u.id} className="msgx-result">
                <Avatar name={u.name} size="sm" />
                <div className="msgx-result__body">
                  <div className="msgx-result__name">{u.name}</div>
                  <div className="msgx-result__email">{u.email}</div>
                </div>
                <button
                  type="button"
                  className="msgx-btn-sm"
                  onClick={() => onConnect(u.id)}
                >
                  Connect
                </button>
              </div>
            ))}
          </>
        )}

        {/* Requests (pending connections) */}
        {pending.length > 0 && (
          <>
            <button
              type="button"
              className="msgx-section"
              onClick={() => setReqOpen((v) => !v)}
              aria-expanded={reqOpen}
            >
              <span
                className={`msgx-section__chevron${reqOpen ? "" : " is-collapsed"}`}
              >
                <ChevronIcon />
              </span>
              Requests
              <span className="msgx-badge" style={{ marginLeft: 4 }}>
                {pending.length}
              </span>
            </button>
            {reqOpen &&
              pending.map((conn) => {
                const isReceiver = conn.myRole === "RECEIVER";
                return (
                  <div key={conn.id} className="msgx-result">
                    <Avatar name={conn.contact.name} size="sm" />
                    <div className="msgx-result__body">
                      <div className="msgx-result__name">
                        {conn.contact.name}
                      </div>
                      <div className="msgx-result__email">
                        {isReceiver ? "Wants to connect" : "Request sent"}
                      </div>
                    </div>
                    {isReceiver ? (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="msgx-btn-sm"
                          onClick={() => onAccept(conn.id)}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="msgx-btn-sm msgx-btn-sm--neutral"
                          onClick={() => onReject(conn.id)}
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="msgx-btn-sm msgx-btn-sm--neutral"
                        onClick={() => onCancel(conn.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                );
              })}
          </>
        )}

        {/* Favorites */}
        <button
          type="button"
          className="msgx-section"
          onClick={() => setFavOpen((v) => !v)}
          aria-expanded={favOpen}
        >
          <span
            className={`msgx-section__chevron${favOpen ? "" : " is-collapsed"}`}
          >
            <ChevronIcon />
          </span>
          Favorites
        </button>
        {favOpen &&
          (favList.length > 0 ? (
            favList.map(renderItem)
          ) : (
            <div className="msgx-empty-list">Star a chat to pin it here.</div>
          ))}

        {/* Chats */}
        <button
          type="button"
          className="msgx-section"
          onClick={() => setChatsOpen((v) => !v)}
          aria-expanded={chatsOpen}
        >
          <span
            className={`msgx-section__chevron${chatsOpen ? "" : " is-collapsed"}`}
          >
            <ChevronIcon />
          </span>
          Chats
        </button>
        {chatsOpen &&
          (chatList.length > 0 ? (
            chatList.map(renderItem)
          ) : (
            <div className="msgx-empty-list">
              {accepted.length === 0
                ? "No connections yet. Search above to find people."
                : "No conversations match your search."}
            </div>
          ))}
      </div>
    </aside>
  );
};

export default ChatSidebar;
