import { Router, Request, Response, NextFunction } from 'express';
import {
  createNewInsight,
  getInsightById,
  getUserInsights,
  getMerchantInsights,
  updateInsightStatus,
  dismissInsightById,
  removeInsight,
  getUserInsightCount,
} from '../services/insightService';

const router = Router();

interface AsyncRequestHandler {
  (req: Request, res: Response, next: NextFunction): Promise<void>;
}

function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function sendResponse<T>(res: Response, result: { success: boolean; data?: T; error?: string; statusCode: number }) {
  if (result.success) {
    res.status(result.statusCode).json({
      success: true,
      data: result.data,
    });
  } else {
    res.status(result.statusCode).json({
      success: false,
      error: result.error,
    });
  }
}

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await createNewInsight(req.body);
    sendResponse(res, result);
  })
);

router.get(
  '/user/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const query = req.query;
    const result = await getUserInsights(userId, query);
    sendResponse(res, result);
  })
);

router.get(
  '/merchant/:merchantId',
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId } = req.params;
    const query = req.query;
    const result = await getMerchantInsights(merchantId, query);
    sendResponse(res, result);
  })
);

router.get(
  '/user/:userId/count',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const status = req.query.status as 'new' | 'viewed' | 'actioned' | 'dismissed' | undefined;
    const result = await getUserInsightCount(userId, status);
    sendResponse(res, result);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await getInsightById(id);
    sendResponse(res, result);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await updateInsightStatus(id, req.body);
    sendResponse(res, result);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await dismissInsightById(id);
    sendResponse(res, result);
  })
);

export default router;
