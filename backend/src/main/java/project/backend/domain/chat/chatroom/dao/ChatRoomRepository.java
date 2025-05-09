package project.backend.domain.chat.chatroom.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import project.backend.domain.chat.chatroom.entity.ChatRoom;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

}
