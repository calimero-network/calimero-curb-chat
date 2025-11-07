import { useEffect, useState } from "react";
import { styled } from "styled-components";
import type { FileObject } from "../types/Common";
import { blobClient } from "@calimero-network/calimero-client";

const ImageWrapper = styled.div`
  position: relative;
  display: inline-flex;
  margin: 4px 8px 4px 0;
  border-radius: 6px;
  overflow: hidden;
  width: 80px;
  height: 80px;
  background-color: #1d1d21;
  border: 1px solid #25252a;
  cursor: pointer;
`;

const StyledImg = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const Placeholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  border-radius: 6px;
  background-color: #25252a;
  color: #7a7a85;
  font-size: 12px;
`;

const ViewerOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const ViewerContent = styled.div`
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
`;

const ViewerImage = styled.img`
  max-width: 90vw;
  max-height: 80vh;
  border-radius: 8px;
  object-fit: contain;
`;

const ViewerActions = styled.div`
  display: flex;
  gap: 12px;
`;

const ViewerButton = styled.button`
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

interface MessageImageFieldProps {
  file: FileObject;
  previewUrl?: string;
  onRemove?: () => void;
  contextId?: string;
}

export default function MessageImageField({
  file,
  previewUrl,
  onRemove,
  contextId,
}: MessageImageFieldProps) {
  const [imageSrc, setImageSrc] = useState<string | undefined>(previewUrl);
  const [isLoading, setIsLoading] = useState(!previewUrl);
  const [hasError, setHasError] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | undefined>();

  useEffect(() => {
    let objectUrl: string | null = null;

    if (!previewUrl && contextId && file.blobId) {
      setIsLoading(true);
      setHasError(false);

      blobClient
        .downloadBlob(file.blobId, contextId)
        .then((blob) => {
          if (!blob) {
            setHasError(true);
            return;
          }
          objectUrl = URL.createObjectURL(blob);
          setImageSrc(objectUrl);
        })
        .catch(() => {
          setHasError(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (!previewUrl) {
      setIsLoading(false);
      if (!contextId) {
        setHasError(true);
      }
    }

    return () => {
      if (!previewUrl && objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      if (viewerSrc && viewerSrc !== previewUrl) {
        URL.revokeObjectURL(viewerSrc);
      }
    };
  }, [previewUrl, contextId, file.blobId, viewerSrc]);

  const openViewer = async () => {
    if (!contextId || !file.blobId) {
      return;
    }

    try {
      const blob = await blobClient.downloadBlob(file.blobId, contextId);
      const url = URL.createObjectURL(blob);
      setViewerSrc(url);
      setIsViewerOpen(true);
    } catch (error) {
      console.error("MessageImageField", "Failed to open image viewer", error);
    }
  };

  const closeViewer = () => {
    if (viewerSrc && viewerSrc !== previewUrl) {
      URL.revokeObjectURL(viewerSrc);
    }
    setViewerSrc(undefined);
    setIsViewerOpen(false);
  };

  const handleDownload = async () => {
    if (!contextId || !file.blobId) {
      return;
    }

    try {
      const blob = await blobClient.downloadBlob(file.blobId, contextId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name || "image";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("MessageImageField", "Failed to download image", error);
    }
  };

  if (hasError) {
    return <Placeholder>Failed to load image</Placeholder>;
  }

  if (isLoading && !imageSrc) {
    return <Placeholder>Loading…</Placeholder>;
  }

  if (!imageSrc) {
    return null;
  }

  return (
    <>
      <ImageWrapper onClick={openViewer}>
        <StyledImg src={imageSrc} alt={file.name || "attachment"} />
      </ImageWrapper>
      {isViewerOpen && viewerSrc && (
        <ViewerOverlay onClick={closeViewer}>
          <ViewerContent onClick={(e) => e.stopPropagation()}>
            <ViewerImage src={viewerSrc} alt={file.name || "attachment"} />
            <ViewerActions>
              <ViewerButton onClick={handleDownload}>Download</ViewerButton>
              {onRemove && <ViewerButton onClick={onRemove}>Remove</ViewerButton>}
              <ViewerButton onClick={closeViewer}>Close</ViewerButton>
            </ViewerActions>
          </ViewerContent>
        </ViewerOverlay>
      )}
    </>
  );
}
