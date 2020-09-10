package com.exadel.frs.core.trainservice.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.MockitoAnnotations.initMocks;
import com.exadel.frs.core.trainservice.component.classifiers.LogisticRegressionClassifier;
import com.exadel.frs.core.trainservice.dao.TrainedModelDao;
import java.util.List;
import lombok.val;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.springframework.context.ApplicationContext;

class FaceClassifierPredictorTest {

    @Mock
    private TrainedModelDao trainedModelDao;

    @Mock
    private ApplicationContext context;

    @InjectMocks
    private FaceClassifierPredictor faceClassifierPredictor;

    private static final String MODEL_KEY = "modelKey";

    @BeforeEach
    void setUp() {
        initMocks(this);
    }

    @Test
    void predict() {
        val logisticRegressionClassifier = mock(LogisticRegressionClassifier.class);
        val faceClassifierAdapter = mock(FaceClassifierAdapter.class);
        double[] input = new double[0];
        int resultCount = 1;
        val expected = List.of(Pair.of(1.0, ""));

        when(trainedModelDao.getModel(MODEL_KEY)).thenReturn(logisticRegressionClassifier);
        when(context.getBean(FaceClassifierAdapter.class)).thenReturn(faceClassifierAdapter);
        when(faceClassifierAdapter.predict(input, resultCount)).thenReturn(expected);

        val actual = faceClassifierPredictor.predict(MODEL_KEY, input, resultCount);

        assertThat(actual).isEqualTo(expected);

        val inOrder = inOrder(trainedModelDao, context, faceClassifierAdapter);
        inOrder.verify(trainedModelDao).getModel(MODEL_KEY);
        inOrder.verify(context).getBean(FaceClassifierAdapter.class);
        inOrder.verify(faceClassifierAdapter).setClassifier(logisticRegressionClassifier);
        inOrder.verify(faceClassifierAdapter).predict(input, resultCount);

        verifyNoMoreInteractions(trainedModelDao);
        verifyNoMoreInteractions(context);
    }
}