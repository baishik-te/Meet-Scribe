import React from 'react';
import { VideoIcon } from './icons';

export const EmptyChatState: React.FC = () => (
  <div className="msgx-empty">
    <span className="msgx-empty__icon">
      <VideoIcon size={30} />
    </span>
    <div className="msgx-empty__title">Select a conversation</div>
    <div className="msgx-empty__sub">
      Choose a connection from the list to view your messages and start chatting.
    </div>
  </div>
);

export default EmptyChatState;
