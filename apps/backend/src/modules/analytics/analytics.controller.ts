import { Controller, Get, Query, Req, UnauthorizedException } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { WeeklyReportQueryDto } from "./dto/weekly-report-query.dto";

type JwtRequestUser = {
  userId: string;
  email: string;
};

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("weekly-report")
  weeklyReport(@Req() req: { user?: JwtRequestUser }, @Query() query: WeeklyReportQueryDto) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.analyticsService.getWeeklyReport(userId, query.from);
  }
}
