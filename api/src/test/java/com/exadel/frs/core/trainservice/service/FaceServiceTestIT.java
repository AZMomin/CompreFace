/*
 * Copyright (c) 2020 the original author or authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

package com.exadel.frs.core.trainservice.service;

import static java.util.UUID.randomUUID;
import static org.assertj.core.api.Assertions.assertThat;
import com.exadel.frs.core.trainservice.cache.FaceCacheProvider;
import com.exadel.frs.core.trainservice.component.FaceClassifierManager;
import com.exadel.frs.core.trainservice.dao.FaceDao;
import com.exadel.frs.core.trainservice.entity.Face;
import com.exadel.frs.core.trainservice.repository.FacesRepository;
import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import lombok.val;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.MockBeans;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.DatabasePopulatorUtils;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.junit.jupiter.SpringExtension;

@DataJpaTest
@ExtendWith(SpringExtension.class)
@Import({FaceServiceImpl.class, FaceDao.class, FaceCacheProvider.class})
@MockBeans({
        @MockBean(RetrainService.class),
        @MockBean(FaceClassifierManager.class)
})
public class FaceServiceTestIT {

    private static final double EMBEDDING = 100500;

    @Autowired
    private FacesRepository facesRepository;

    @Autowired
    private FaceServiceImpl faceService;

    @Autowired
    private DataSource dataSource;

    private static final String MODEL_KEY = randomUUID().toString();
    private static final String MODEL_KEY_OTHER = randomUUID().toString();

    @BeforeEach
    void setUp() {
        executeScript(dataSource, "schema.sql");

        val faceA = makeFace("A", MODEL_KEY);
        val faceB = makeFace("B", MODEL_KEY_OTHER);
        val faceC = makeFace("C", MODEL_KEY);

        facesRepository.saveAll(List.of(faceA, faceB, faceC));
    }

    @Test
    public void deleteFaceByGuid() {
        val faces = facesRepository.findByApiKey(MODEL_KEY);
        val face = faces.get(new Random().nextInt(faces.size()));

        faceService.deleteFaceById(face.getId(), MODEL_KEY);

        val actual = facesRepository.findByApiKey(MODEL_KEY);

        assertThat(actual).hasSize(faces.size() - 1);
        assertThat(actual).doesNotContain(face);
    }

    @Test
    public void findFaces() {
        val faces = facesRepository.findAll()
                                   .stream()
                                   .filter(face -> face.getApiKey().equals(MODEL_KEY))
                                   .collect(Collectors.toList());

        val actual = faceService.findFaces(MODEL_KEY);

        assertThat(actual).hasSize(faces.size());
    }

    @Test
    public void deleteFaceByName() {
        val faces = facesRepository.findByApiKey(MODEL_KEY);
        val face = faces.get(new Random().nextInt(faces.size()));

        faceService.deleteFaceByName(face.getFaceName(), face.getApiKey());

        val actual = facesRepository.findByApiKey(MODEL_KEY);

        assertThat(actual).hasSize(faces.size() - 1);
        assertThat(actual).doesNotContain(face);
    }

    @Test
    public void deleteFacesByModel() {
        val faces = facesRepository.findAll();
        val oneKeyFaces = faces.stream()
                               .filter(face -> face.getApiKey().equals(MODEL_KEY))
                               .collect(Collectors.toList());

        faceService.deleteFacesByModel(MODEL_KEY);

        val actual = facesRepository.findAll();

        assertThat(actual).hasSize(faces.size() - 2);
        assertThat(oneKeyFaces).allSatisfy(face -> {
            assertThat(actual).doesNotContain(face);
        });
    }

    @AfterEach
    public void cleanUp() {
        faceService.deleteFacesByModel(MODEL_KEY);
        faceService.deleteFacesByModel(MODEL_KEY_OTHER);
    }

    public static Face makeFace(final String name, final String modelApiKey) {
        return new Face()
                .setFaceName(name)
                .setApiKey(modelApiKey)
                .setEmbedding(new Face.Embedding(List.of(EMBEDDING), null))
                .setFaceImg("hex-string-1".getBytes())
                .setRawImg("hex-string-2".getBytes())
                .setId(randomUUID().toString());
    }

    public static void executeScript(final DataSource dataSource, final String path) {
        val script = new ClassPathResource(path);
        val populator = new ResourceDatabasePopulator();
        populator.addScript(script);

        DatabasePopulatorUtils.execute(populator, dataSource);
    }
}