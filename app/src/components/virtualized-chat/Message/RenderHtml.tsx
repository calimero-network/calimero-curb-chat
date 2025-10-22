// eslint-disable-next-line
import React from 'react';
import { sanitizeHtml } from '../utils';

export interface RenderHtmlProps {
  html: string;
}

const RenderHtml: React.FC<RenderHtmlProps> = ({ html }) => (
  <div
    className="msg-content"
    dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
  />
);

export default RenderHtml;
