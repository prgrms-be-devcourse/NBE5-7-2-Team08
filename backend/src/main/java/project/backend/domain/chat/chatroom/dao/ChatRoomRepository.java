package project.backend.domain.chat.chatroom.dao;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import project.backend.domain.chat.chatroom.entity.ChatRoom;


public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

    @Query("SELECT cr FROM ChatRoom cr " +
            "JOIN FETCH cr.participants ps " +
            "JOIN FETCH ps.participant " +
            "WHERE ps.participant.id = :memberId")
    Page<ChatRoom> findAllRoomsByMemberId(Long memberId, Pageable pageable);

    Optional<ChatRoom> findByInviteCode(String inviteCode);

    Page<ChatRoom> findAllRoomsByOwnerId(Long ownerId, Pageable pageable);

}

