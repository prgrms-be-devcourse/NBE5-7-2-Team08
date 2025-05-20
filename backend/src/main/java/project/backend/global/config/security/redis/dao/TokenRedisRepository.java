package project.backend.global.config.security.redis.dao;

import java.util.Optional;

import org.springframework.data.repository.CrudRepository;
import project.backend.global.config.security.redis.entity.TokenRedis;

public interface TokenRedisRepository extends CrudRepository<TokenRedis, Long> {

    Optional<TokenRedis> findByAccessToken(String accessToken);
}
