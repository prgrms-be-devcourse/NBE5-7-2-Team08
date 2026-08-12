package project.backend.domain.dm.dmMessage.dao;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import project.backend.domain.dm.dmMessage.entity.DmMessage;

public interface DmMessageRepository extends JpaRepository<DmMessage, Long> {

	@Query("SELECT m.id FROM DmMessage m WHERE m.room.id = :roomId ORDER BY m.sentAt DESC, m.id DESC")
	List<Long> findLatestMessageIdsByRoomId(@Param("roomId") Long roomId, Pageable pageable);

	@Query("""
		SELECT m.id FROM DmMessage m
		WHERE m.room.id = :roomId
		  AND (m.sentAt < :cursorSentAt OR (m.sentAt = :cursorSentAt AND m.id < :cursorId))
		ORDER BY m.sentAt DESC, m.id DESC
		""")
	List<Long> findMessageIdsBeforeCursor(
		@Param("roomId") Long roomId,
		@Param("cursorSentAt") LocalDateTime cursorSentAt,
		@Param("cursorId") Long cursorId,
		Pageable pageable);

	@Query("SELECT m FROM DmMessage m JOIN FETCH m.sender WHERE m.id IN :ids")
	List<DmMessage> findAllWithSenderByIdIn(@Param("ids") List<Long> ids);
}
