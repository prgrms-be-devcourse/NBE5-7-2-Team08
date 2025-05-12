package project.backend.domain.chat.chatroom.dao;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import project.backend.domain.chat.chatroom.entity.ChatRoom;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

	Optional<ChatRoom> findByInviteCode(String inviteCode);
}
