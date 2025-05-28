package project.backend.domain.chat.chatroom.dao;

import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import java.util.Optional;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.member.entity.Member;

public interface ChatParticipantRepository extends JpaRepository<ChatParticipant, Long> {

	Optional<ChatParticipant> findByParticipantAndChatRoom(Member member, ChatRoom chatRoom);

	//fixme chat_participant에 join_at 추가해서 가장 마지막에 참여한 채팅방을 반환하도록 변경
	@Query("""
        SELECT cp.chatRoom.id 
        FROM ChatParticipant cp 
        WHERE cp.participant.email = :email 
        AND cp.isActive = true
        ORDER BY cp.chatRoom.id DESC
        LIMIT 1
        """)
	Optional<Long> findMostLargeRoomIdByEmailAndIsActiveTrue(@Param("email") String email);

	boolean existsByParticipantIdAndChatRoomId(Long participantId, Long chatRoomId);

	@EntityGraph(attributePaths = {"participant"})
	@Query("SELECT cp FROM ChatParticipant cp WHERE cp.chatRoom = :chatRoom AND cp.isActive = true")
	List<ChatParticipant> findByChatRoomAndIsActiveTrue(@Param("chatRoom") ChatRoom chatRoom);

	Optional<ChatParticipant> findByChatRoomIdAndParticipantId(Long chatRoomId, Long participantId);

	Optional<ChatParticipant> findByChatRoom_IdAndParticipant_Id(Long ChatRoomId,
		Long participantId);

	@Query("""
		SELECT cp FROM ChatParticipant cp 
		WHERE cp.chatRoom.id = :roomId 
		AND cp.participant.id = :participantId 
		AND cp.isActive = true
		""")
	Optional<ChatParticipant> findByChatRoomIdAndParticipantIdAndIsActiveTrue(
		@Param("roomId") Long roomId,
		@Param("participantId") Long participantId
	);

}

