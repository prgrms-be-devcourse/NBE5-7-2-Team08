import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChevronRight, FaChevronDown, FaUser, FaComments, FaRegCommentDots, FaPlus } from 'react-icons/fa';

const Sidebar = () => {
  const navigate = useNavigate();
  const [expandedRoom, setExpandedRoom] = useState(null);

  const chatRooms = [
    { id: 1, name: '2차 프로젝트', participants: ['데브코스'] },
    { id: 4, name: '채팅 프로젝트', participants: ['지은', '창인', '문성', '강현'] }
  ];

  const toggleRoom = (id) => {
    setExpandedRoom(prev => prev === id ? null : id);
  };

  return (
    <div style={{ width: '200px', height: '100%', justifyContent: 'space-between', backgroundColor: '#2588F1', color: 'white', display: 'flex', flexDirection: 'column',  boxSizing: 'border-box'}}>
        <div>
            <h3 style={{ marginTop: '20px', marginBottom: '20px', marginLeft: '10px'}}>Chat Rooms</h3>
            {chatRooms.map(room => (
            <div key={room.id} style={{ padding: '10px'}}>
                <div
                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => toggleRoom(room.id)}
                >
                <FaRegCommentDots style={{ marginRight: '8px' }} />
                <span style={{ flex: 1 }}>{room.name}</span>
                {expandedRoom === room.id ? <FaChevronDown /> : <FaChevronRight />}
                </div>

                {expandedRoom === room.id && (
                <div style={{ paddingLeft: '20px', marginTop: '5px' }}>
                    {room.participants.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px', fontSize: '14px' }}>
                        <FaUser style={{ marginRight: '6px' }} />
                        {p}
                    </div>
                    ))}
                </div>
                )}
            </div>
            ))}
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