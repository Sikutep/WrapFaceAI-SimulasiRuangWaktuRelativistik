import { useEffect, useState, useRef } from 'react';
import Peer, { type MediaConnection } from 'peerjs';

export function usePeerJS(localStream: MediaStream | null) {
  const [peerId, setPeerId] = useState<string>('');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
    });

    peer.on('call', (call: MediaConnection) => {
      if (localStream) {
        call.answer(localStream);
      } else {
        call.answer(); // Still answer if we don't have stream yet, though unexpected
      }
      call.on('stream', (remoteStream) => {
        setRemoteStream(remoteStream);
      });
    });

    peer.on('error', (err) => {
       setError(err.type + ": " + err.message);
    });

    return () => {
      peer.destroy();
    };
  }, [localStream]);

  const connectToPeer = (remoteId: string) => {
    if (!peerRef.current || !localStream) {
        setError("Cannot connect: PeerJS or local stream not ready.");
        return;
    }
    setError(null);
    const call = peerRef.current.call(remoteId, localStream);
    call.on('stream', (stream) => {
      setRemoteStream(stream);
    });
  };

  const disconnectPeer = () => {
      setRemoteStream(null);
  };

  return { peerId, remoteStream, connectToPeer, disconnectPeer, peerError: error };
}
