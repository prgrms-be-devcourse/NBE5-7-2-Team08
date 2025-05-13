import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChevronRight, FaChevronDown, FaUser, FaComments, FaRegCommentDots, FaPlus } from 'react-icons/fa';
import axios from 'axios';

const Sidebar = () => {
  const navigate = useNavigate();
  const [expandedRoom, setExpandedRoom] = useState(null);
  const [chatRooms, setChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchChatRooms = async () => {
      try {
        setLoading(true);
        const response = await axios.get('http://localhost:8080/chat-rooms');
        
        // response.data.content에서 각 채팅방의 participants 배열을 수정하여 'owner'를 'isOwner'로 변경
        const rooms = (response.data.content || []).map(room => ({
          ...room,
          participants: room.participants.map(p => ({
            ...p,
            isOwner: p.owner // owner 필드를 isOwner로 매핑
          }))
        }));

        setChatRooms(rooms);
      } catch (err) {
        console.error("채팅방 목록을 불러오는데 실패했습니다:", err);
        setError("채팅방 목록을 불러오는데 실패했습니다");

        // 임시 폴백 데이터
        setChatRooms([
          {
            roomName: '2차 프로젝트',
            ownerId: 1,
            participantCount: 1,
            participants: [{ memberId: 1, nickname: '데브코스', profileImageUrl: '', isOwner: true }]
          },
          {
            roomName: '채팅 프로젝트',
            ownerId: 2,
            participantCount: 4,
            participants: [
              { memberId: 2, nickname: '지은', profileImageUrl: '', isOwner: true },
              { memberId: 3, nickname: '창인', profileImageUrl: '', isOwner: false },
              { memberId: 4, nickname: '문성', profileImageUrl: '', isOwner: false },
              { memberId: 5, nickname: '강현', profileImageUrl: '', isOwner: false }
            ]
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchChatRooms();
  }, []);

  const toggleRoom = (id) => {
    setExpandedRoom(prev => prev === id ? null : id);
  };

  return (
    <div style={{ 
      width: '200px', 
      height: '100%', 
      justifyContent: 'space-between', 
      backgroundColor: '#2588F1', 
      color: 'white', 
      display: 'flex', 
      flexDirection: 'column', 
      boxSizing: 'border-box'
    }}>
      <div>
        <h3 style={{ marginTop: '20px', marginBottom: '20px', marginLeft: '10px'}}>Chat Rooms</h3>
        {loading ? (
          <div style={{ padding: '10px', textAlign: 'center' }}>채팅방 로딩 중...</div>
        ) : error ? (
          <div style={{ padding: '10px', color: '#ff6b6b' }}>{error}</div>
        ) : (
          chatRooms.map((room, index) => (
            <div key={index} style={{ padding: '10px'}}>
              <div
                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => toggleRoom(index)}
              >
                <FaRegCommentDots style={{ marginRight: '8px' }} />
                <span style={{ flex: 1 }}>{room.roomName}</span>
                {expandedRoom === index ? <FaChevronDown /> : <FaChevronRight />}
              </div>
              {expandedRoom === index && (
                <div style={{ paddingLeft: '20px', marginTop: '5px' }}>
                  {room.participants.map((participant, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: '5px', 
                        fontSize: '14px' 
                      }}
                    >
                      <FaUser style={{ marginRight: '6px' }} />
                      <span>
                        {participant.nickname}
                        {participant.isOwner && (
                          <span style={{ 
                            marginLeft: '4px', 
                            fontSize: '11px', 
                            backgroundColor: 'rgba(255,255,255,0.2)', 
                            padding: '1px 4px', 
                            borderRadius: '3px' 
                          }}>
                            방장
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button
          style={{
            width: '90%',
            marginTop: '20px',
            padding: '10px',
            backgroundColor: '#2377FF',
            color: 'white',
            border: '1px solid #5AAAFF',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
          onClick={() => navigate('/join')}
        >
          <FaComments style={{ marginRight: '8px' }} />
          Join Chat Room
        </button>
        <button
          style={{
            width: '90%',
            marginTop: '10px',
            padding: '10px',
            backgroundColor: '#2377FF',
            color: 'white',
            border: '1px solid #5AAAFF',
            cursor: 'pointer',
            borderRadius: '4px',
            marginBottom: '10px'
          }}
          onClick={() => navigate('/create')}
        >
          <FaPlus style={{ marginRight: '8px' }} />
          New Chat Room
        </button>
      </div>
    </div>
  );
};

export default Sidebar;