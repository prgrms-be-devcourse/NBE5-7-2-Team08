import React from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../components/api/axiosInstance';

let initRan = false;

const Home = () => {
  const navigate = useNavigate();

  if (!initRan) {
    initRan = true;

    (async () => {
      try {
        const res = await axiosInstance.get('/chat-rooms/recent');
        const { roomId, inviteCode } = res.data;

        if (roomId) {
          navigate(`/chat/${roomId}/${inviteCode}`);
        } else {
          console.warn('roomId 없음');
          navigate('/blank');
        }

      } catch (err) {
        console.error('🚨 에러 발생:', err);
        const status = err.response?.status;

        if (status === 404) {
          navigate('/blank');
        } else if (status === 401) {
          alert('인증이 필요합니다.');
          navigate('/login');
        } else {
          alert('서버 오류로 채팅방 이동 실패');
          navigate('/');
        }
      }
    })();
  }

  return <div>가장 최근 채팅방으로 이동 중...</div>;
};

export default Home;
