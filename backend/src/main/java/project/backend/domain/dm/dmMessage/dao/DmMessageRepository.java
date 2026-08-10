package project.backend.domain.dm.dmMessage.dao;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import project.backend.domain.dm.dmMessage.entity.DmMessage;

public interface DmMessageRepository extends JpaRepository<DmMessage, Long> {

	@Query("SELECT m.id FROM DmMessage m WHERE m.room.id = :roomId ORDER BY m.sentAt DESC, m.id DESC")
	Page<Long> findMessageIdsByRoomId(@Param("roomId") Long roomId, Pageable pageable);

	@Query("SELECT m FROM DmMessage m JOIN FETCH m.sender WHERE m.id IN :ids")
	List<DmMessage> findAllWithSenderByIdIn(@Param("ids") List<Long> ids);
}
