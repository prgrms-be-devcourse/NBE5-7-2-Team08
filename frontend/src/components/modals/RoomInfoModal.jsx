import React, { useEffect, useRef, useState } from 'react';
import {
  FaInfoCircle,
  FaTimes,
  FaGithub,
  FaCopy,
  FaUser,
  FaCrown
} from 'react-icons/fa';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import axios from 'axios';

const RoomInfoModal = ({ room, sidebarRef, onClose, showToast }) => {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const stompClientRef = useRef(null);
  const hasLoadedInitialData = useRef(false);

  const copyInviteCode = () => {
    if (room?.inviteCode) {
      navigator.clipboard.writeText(room.inviteCode)
        .then(() => showToast('초대 코드가 클립보드에 복사되었습니다.'))
        .catch(err => console.error('클립보드 복사 실패:', err));
    }
  };

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:8080/chat-rooms/${room.roomId}/participants`, {
        withCredentials: true,
      });
      console.log('참가자 응답:', response.data);
      setParticipants(response.data);
    } catch (err) {
      console.error('참가자 목록 가져오기 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (room?.roomId && !hasLoadedInitialData.current) {
      fetchParticipants();
      hasLoadedInitialData.current = true;
    }

    if (!room?.roomId) return;

    const socket = new SockJS('http://localhost:8080/ws');
    const stomp = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        stomp.subscribe(`/topic/chat/${room.roomId}/refresh`, () => {
          fetchParticipants();
        });
      },
      onStompError: (frame) => {
        console.error('STOMP error', frame);
      }
    });

    stomp.activate();
    stompClientRef.current = stomp;

    return () => {
      stomp.deactivate();
    };
  }, [room?.roomId]);

  return (
    <>
      <div
        className="modal-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.3)',
          zIndex: 990
        }}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: sidebarRef.current ? `calc(${sidebarRef.current.offsetWidth}px + 20px)` : '280px',
        transform: 'translateY(-50%)',
        width: '320px',
        maxHeight: '80vh',
        backgroundColor: 'white',
        boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
        zIndex: 1000,
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#2588F1',
          color: 'white'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaInfoCircle size={16} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span>채팅방 정보</span>
              <span style={{ fontSize: '12px', opacity: 0.8 }}>
                {room.name || room.roomName || `Room ${room.uniqueId}`}
              </span>
            </div>
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'white'
            }}
          >
            <FaTimes size={16} />
          </button>
        </div>

        <div style={{ padding: '16px', maxHeight: 'calc(80vh - 60px)', overflowY: 'auto' }}>
          {room.repositoryUrl && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#f7f9fc',
              border: '1px solid #e1e8ed',
              borderRadius: '8px'
            }}>
              <div style={{ fontWeight: '500', marginBottom: '8px', fontSize: '14px' }}>GitHub Repository</div>
              <a
                href={room.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#0366d6',
                  textDecoration: 'none',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  wordBreak: 'break-all'
                }}
              >
                <FaGithub />
                {room.repositoryUrl}
              </a>
            </div>
          )}

          {room.inviteCode && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ fontWeight: '500', marginBottom: '8px', fontSize: '14px' }}>초대 코드</div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}>
                  {room.inviteCode}
                </div>
                <button
                  onClick={copyInviteCode}
                  style={{
                    marginLeft: '8px',
                    backgroundColor: '#e9ecef',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px',
                    cursor: 'pointer'
                  }}
                  title="초대 코드 복사"
                >
                  <FaCopy size={14} color="#495057" />
                </button>
              </div>
            </div>
          )}

          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
            채팅방 멤버 {participants && (
              <span>({participants.length}명)</span>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '16px', textAlign: 'center' }}>로딩 중...</div>
          ) : participants && participants.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* 방장(owner) 먼저 표시 */}
              {participants.filter(p => p.owner).map((p, idx) => (
                <div key={`owner-${idx}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 215, 0, 0.1)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 215, 0, 0.2)'
                }}>
                  <div style={{
                    backgroundColor: '#fff',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px',
                    border: '2px solid #FFD700'
                  }}>
                    <FaCrown style={{ color: '#FFD700' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                      {p.nickname || '알 수 없음'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      <span style={{
                        backgroundColor: 'rgba(255, 215, 0, 0.2)',
                        color: '#856404',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}>
                        방장
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* 일반 멤버 표시 */}
              {participants.filter(p => !p.owner).map((p, idx) => (
                <div key={`member-${idx}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef',
                }}>
                  <div style={{
                    backgroundColor: '#e9ecef',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px'
                  }}>
                    <FaUser style={{ color: '#6c757d' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '14px' }}>
                      {p.nickname || '알 수 없음'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>
                      <span style={{
                        backgroundColor: '#e9ecef',
                        color: '#495057',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '11px'
                      }}>
                        멤버
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              color: '#6c757d',
              backgroundColor: '#f8f9fa',
              borderRadius: '6px',
              border: '1px solid #e9ecef',
              fontSize: '14px'
            }}>
              멤버 정보를 불러올 수 없습니다
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default RoomInfoModal;

