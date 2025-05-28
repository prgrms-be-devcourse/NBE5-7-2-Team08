package project.backend.domain.chat.chatmessage.dao;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
	@Query("""
        SELECT cm.chatRoom.id 
        FROM ChatMessage cm
        JOIN ChatParticipant cp ON cp.chatRoom.id = cm.chatRoom.id AND cp.participant.email = :email
        WHERE cp.isActive = true
        ORDER BY cm.sendAt DESC
        LIMIT 1
        """)
	Optional<Long> findMostRecentRoomIdByMemberEmailAndIsActiveTrue(@Param("email") String email);

	@Query(value = """
		SELECT * 
		FROM chat_message 
		WHERE room_id = :roomId 
		AND MATCH(content) AGAINST (:keyword IN NATURAL LANGUAGE MODE)
		""", nativeQuery = true)
	Page<ChatMessage> searchByKeywordAndRoomId(String keyword, Long roomId, Pageable pageable);

	List<ChatMessage> findByChatRoom_IdOrderBySendAtAsc(Long roomId);

	List<ChatMessage> findByIdIn(List<Long> ids);

}
