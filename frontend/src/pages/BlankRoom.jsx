import React from 'react';
import SideBar from '../components/SideBar';
import Header from '../components/header'


const BlankRoom = () => {

  return (
    <div style={{ backgroundColor: '#e0e0e0', height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box'}}>

      {/* Top Bar */}
      <Header></Header>


      {/* 본문 전체 영역 */}
      <div style={{ flex:1, display: 'flex', overflow: 'hidden' }}>
        <SideBar />

        {/* Chat area */}
        <div style={{
          flex: 1,
          width: '700px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)'
        }}>

        <div style={{
            flex: 1,
            overflowY: 'auto',
            backgroundColor: '#fff',
            padding: '15px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            marginBottom: '15px',
            minHeight: 0
          }}>
          </div>

          {/* 메시지 입력 폼 */}
          <div style={{
            backgroundColor: '#d3d3d3',
            border: '1px solid black',
            borderRadius: '3px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            marginTop: 'auto'
          }}>
            <div style={{ marginBottom: '5px' }}>
              <span style={{ marginRight: '10px' }}>사진</span>
              <span>코드</span>
            </div>
            <div style={{ display: 'flex' }}>
              <textarea
                style={{
                  flex: 1,
                  height: '30px',
                  resize: 'none',
                  padding: '15px',
                  fontSize: '16px',
                  backgroundColor: '#f0f0f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'not-allowed'
                }}
                disabled
                placeholder="채팅방에 참여해야 메시지를 보낼 수 있습니다"
              />
              <button
                disabled
                style={{
                  backgroundColor: '#2c2f7e',
                  color: 'white',
                  padding: '15px 20px',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'not-allowed'
                }}
              >
                전송
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default BlankRoom;