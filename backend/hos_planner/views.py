from rest_framework.decorators import api_view
from rest_framework.response import Response
from .hos_engine import HOSTripPlanner

@api_view(['POST'])
def plan_trip(request):
    data = request.data
    current_location = data.get('current_location')
    pickup_location = data.get('pickup_location')
    dropoff_location = data.get('dropoff_location')
    current_cycle_used = float(data.get('current_cycle_used', 0.0))

    if not current_location or not pickup_location or not dropoff_location:
        return Response({"error": "Missing locations"}, status=400)

    planner = HOSTripPlanner()
    result = planner.plan_trip(current_location, pickup_location, dropoff_location, current_cycle_used)
    
    if "error" in result:
        return Response(result, status=400)

    return Response(result)

@api_view(['GET'])
def health_check(request):
    return Response({"status": "ok"})
