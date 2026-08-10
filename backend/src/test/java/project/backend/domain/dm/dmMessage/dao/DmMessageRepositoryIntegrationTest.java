package project.backend.domain.dm.dmMessage.dao;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.persistence.EntityManager;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.LongStream;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import project.backend.domain.dm.dmMessage.entity.DmMessage;
import project.backend.global.config.TestRedisConfig;

@SpringBootTest
@Testcontainers
@Transactional
@ActiveProfiles("test")
@Import(TestRedisConfig.class)
class DmMessageRepositoryIntegrationTest {

    @Container
    static MySQLContainer<?> mysql = new MySQLContainer<>(DockerImageName.parse("mysql:8.4"))
        .withDatabaseName("testdb").withUsername("test").withPassword("test");

    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
        .withExposedPorts(6379);

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", mysql::getJdbcUrl);
        registry.add("spring.datasource.username", mysql::getUsername);
        registry.add("spring.datasource.password", mysql::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    }

    @Autowired DmMessageRepository dmMessageRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired EntityManager entityManager;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("INSERT INTO member (member_id, nickname, profile_image, username) VALUES (3001, 'member1', 'image', 'dm-member-1')");
        jdbcTemplate.update("INSERT INTO member (member_id, nickname, profile_image, username) VALUES (3002, 'member2', 'image', 'dm-member-2')");
        jdbcTemplate.update("INSERT INTO dm_room (id, created_at, member1_id, member2_id) VALUES (3001, '2026-01-01 00:00:00', 3001, 3002)");

        for (long id = 3001; id <= 3030; id++) {
            LocalDateTime sentAt = LocalDateTime.of(2026, 1, 1, 0, 0)
                .plusSeconds((id - 3001) / 10);
            jdbcTemplate.update(
                "INSERT INTO dm_message (id, content, sent_at, type, room_id, sender_id) VALUES (?, ?, ?, 'TEXT', 3001, 3002)",
                id, "message-" + id, Timestamp.valueOf(sentAt));
        }
        entityManager.clear();
    }

    @Test
    @DisplayName("DM ID Page는 sentAt과 id 역순으로 조회하고 전체 개수를 유지한다")
    void findMessageIdsByRoomId_ordersDeterministicallyAndKeepsTotalCount() {
        Page<Long> result = dmMessageRepository.findMessageIdsByRoomId(
            3001L, PageRequest.of(0, 20));

        assertThat(result.getTotalElements()).isEqualTo(30);
        assertThat(result.getContent()).containsExactlyElementsOf(
            LongStream.iterate(3030, value -> value - 1).limit(20).boxed().toList());
    }

    @Test
    @DisplayName("DM ID Page 경계에는 메시지 중복과 누락이 없다")
    void findMessageIdsByRoomId_hasNoDuplicatesOrGapsAcrossPages() {
        List<Long> first = dmMessageRepository.findMessageIdsByRoomId(
            3001L, PageRequest.of(0, 20)).getContent();
        List<Long> second = dmMessageRepository.findMessageIdsByRoomId(
            3001L, PageRequest.of(1, 20)).getContent();

        assertThat(first).doesNotContainAnyElementsOf(second);
        assertThat(first).containsExactlyElementsOf(
            LongStream.iterate(3030, value -> value - 1).limit(20).boxed().toList());
        assertThat(second).containsExactlyElementsOf(
            LongStream.iterate(3010, value -> value - 1).limit(10).boxed().toList());
    }

    @Test
    @DisplayName("선택된 DM 조회는 sender를 함께 로딩한다")
    void findAllWithSenderByIdIn_fetchesSender() {
        List<DmMessage> messages = dmMessageRepository.findAllWithSenderByIdIn(
            List.of(3030L, 3029L));

        assertThat(messages).extracting(DmMessage::getId)
            .containsExactlyInAnyOrder(3030L, 3029L);
        assertThat(messages).allMatch(message -> Hibernate.isInitialized(message.getSender()));
    }
}
