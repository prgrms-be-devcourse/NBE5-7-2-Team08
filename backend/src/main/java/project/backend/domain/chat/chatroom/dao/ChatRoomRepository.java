package project.backend.domain.chat.chatroom.dao;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import project.backend.domain.chat.chatroom.entity.ChatRoom;


public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

	@Query("""
		SELECT DISTINCT cr
		FROM ChatRoom cr
		JOIN cr.participants cp
		WHERE cp.participant.id = :memberId
		""")
	Page<ChatRoom> findChatRoomsByParticipantId(@Param("memberId") Long memberId,
		Pageable pageable);

	Optional<ChatRoom> findByInviteCode(String inviteCode);
	
	Page<ChatRoom> findAllRoomsByOwnerId(Long ownerId, Pageable pageable);

}

