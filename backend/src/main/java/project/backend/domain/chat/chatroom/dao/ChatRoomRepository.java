package project.backend.domain.chat.chatroom.dao;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import project.backend.domain.chat.chatroom.entity.ChatRoom;


public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

	@EntityGraph(attributePaths = {"participants", "participants.participant"})
	Page<ChatRoom> findByParticipants_Participant_Id(Long memberId, Pageable pageable);

	Optional<ChatRoom> findByInviteCode(String inviteCode);

	Page<ChatRoom> findAllRoomsByOwnerId(Long ownerId, Pageable pageable);

}

